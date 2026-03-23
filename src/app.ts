import {
    AutojoinRoomsMixin,
    MatrixAuth,
    MatrixClient,
    RustSdkCryptoStorageProvider,
    SimpleFsStorageProvider,
} from "matrix-bot-sdk";
import {StoreType} from "@matrix-org/matrix-sdk-crypto-nodejs";
import {createClient} from "redis";
import {v4 as uuid} from "uuid";
import {KumaRequest} from "./models/kumaRequest.ts";
import {UserAuthority} from "./models/userAuthority.ts";
import {SourceSystem} from "./models/sourceSystem.ts";
import {KumaResponse} from "./models/kumaResponse.ts";

console.info("Starting kumakaini-js-matrix {TODO:AppVersion} on {TODO:MachineName}");

const supportedVideoFileTypes = [ "mp4" ];

const kumaRequestsStreamName = "kuma:requests";
const kumaResponsesStreamName = "kuma:matrix:responses";
const kumaResponsesStreamGroup = "consumers";

const homeServerUrl = process.env.KUMA_MATRIX_HOMESERVER_URL;
const accessToken = process.env.KUMA_MATRIX_ACCESS_TOKEN;
const adminUsername = process.env.KUMA_MATRIX_ADMIN_USERNAME;

if (homeServerUrl === undefined) {
    console.error("KUMA_MATRIX_HOMESERVER_URL must be defined");
    process.exit(1);
}

// Get an access token if it's not set
if (accessToken === undefined)
{
    console.info("Logging in to get a new access token");
    const username = process.env.KUMA_MATRIX_USERNAME;
    const password = process.env.KUMA_MATRIX_PASSWORD;

    if (username === undefined || password === undefined) {
        console.error("KUMA_MATRIX_USERNAME and KUMA_MATRIX_PASSWORD must be defined");
        process.exit(1);
    }

    const auth = new MatrixAuth(homeServerUrl);
    const authClient = await auth.passwordLogin(username, password);

    console.info(`Access token: ${authClient.accessToken}`);

    process.exit(0);
}

// Set up the Matrix client
console.info("Setting up the Matrix client");
const storage = new SimpleFsStorageProvider("storage.json");
const crypto = new RustSdkCryptoStorageProvider("./crypto", StoreType.Sqlite);
const matrix = new MatrixClient(homeServerUrl, accessToken, storage, crypto);
const userId = await matrix.getUserId();

AutojoinRoomsMixin.setupOnClient(matrix);
matrix.on("room.message", handleMessage);
matrix.on("room.invite", handleInvite);

// Set up the Redis client
console.info("Setting up the Redis client")
const redisHost = process.env.REDIS_HOST ?? "localhost:6379";
const redisPassword = process.env.REDIS_PASSWORD ?? "redis";
const redis = await createClient({
    url: `redis://${redisHost}`,
    password: redisPassword
}).connect();

redisStreamConsumer().then(() => console.info("Started Redis consumer"));

// Start the Matrix client
console.info("Listening for updates")
matrix.start().then(() => console.info(`Logged in as ${userId}`));

async function redisStreamConsumer() {
    const streamExists = await redis.exists(kumaResponsesStreamName);
    let streamGroupExists = false;
    if (streamExists) {
        const groupInfo = await redis.xInfoGroups(kumaResponsesStreamName);

        if (groupInfo.length === 0) streamGroupExists = false;
        for (let i = 0; i < groupInfo.length; i++) {
            if (groupInfo[i]?.name === kumaResponsesStreamGroup) {
                streamGroupExists = true;
                break;
            }
        }
    }

    if (!streamExists || !streamGroupExists) {
        console.info(`Creating consumer group: ${kumaResponsesStreamName} - ${kumaResponsesStreamGroup}`);
        await redis.xGroupCreate(kumaResponsesStreamName, kumaResponsesStreamGroup, "0-0");
    }

    console.info(`Starting stream consumer: ${kumaResponsesStreamName} - ${kumaResponsesStreamGroup}`);

    const onStreamRangeElapsed = async () => {
        try {
           await redis.xRevRange(
                kumaResponsesStreamName,
                "-",
                "+",
                { COUNT: 1});
        } catch (e) {
            console.error("An exception was thrown while processing stream range", e);
        }

        return onStreamRangeElapsed();
    };

    const onResponseConsumeElapsed = async () => {
        try {
            const streamEntries = await redis.xReadGroup(
                kumaResponsesStreamGroup,
                uuid(),
                { key: kumaResponsesStreamName, id: ">" });

            if (!streamEntries) return onResponseConsumeElapsed();

            // @ts-ignore
            for (const message of streamEntries?.[0]?.messages) {
                await handleKumaResponse(message.message.response);
                await redis.xAck(kumaResponsesStreamName, kumaResponsesStreamGroup, message.id)
            }
        } catch (e) {
            console.error("An exception was thrown while processing stream entries", e);
        }

        return onResponseConsumeElapsed();
    };

    onStreamRangeElapsed().then();
    onResponseConsumeElapsed().then();
}

async function handleMessage(roomId: string, event: any) {
    console.log("room.message", roomId, event);

    if (event["content"]?.["msgtype"] !== "m.text") return;
    if (event["sender"] === userId) return;

    const username = event["sender"];
    const message = event["content"]["body"];
    const messageId = event["event_id"];
    // TODO: add mods
    let userAuthority = UserAuthority.User;
    if (username === adminUsername) userAuthority = UserAuthority.Administrator;

    const roomMembers = await matrix.getRoomMembers(roomId);

    let kumaInRoom = false;
    roomMembers.forEach((member) => {
        if (member["event"]["sender"] === userId) {
            kumaInRoom = true;
        }
    });

    let isPrivate = roomMembers.length === 2 && kumaInRoom;
    // TODO: distinguish nsfw group chats
    let isNsfw = false;
    if (isPrivate) isNsfw = true;

    const request = new KumaRequest(
        username,
        message,
        SourceSystem.Matrix,
        messageId,
        userAuthority,
        roomId,
        isPrivate,
        isNsfw);

    const requestSerialized = JSON.stringify(request);

    await redis.xAdd(
        kumaRequestsStreamName,
        "*",
        {"request": requestSerialized});
}

async function handleInvite(roomId: string, inviteEvent: any) {
    if (inviteEvent["sender"] !== adminUsername) return;
    await matrix.joinRoom(roomId);
}

async function handleKumaResponse(message: string) {
    if (!message) return;

    const kumaResponse: KumaResponse = JSON.parse(message);
    if (!kumaResponse.channel_id) return;

    try {
        if (kumaResponse.image) {
            const fileName = kumaResponse.image.url.split("/").pop();
            const fileType = kumaResponse.image.url.split(".").pop();

            if (!fileType) {
                console.error("not a file, somehow", kumaResponse.image.url);
                return;
            }

            const caption = kumaResponse.image.description;
            let captionFormatted = caption.replaceAll("\n", "<br>");
            if (kumaResponse.image.referrer && kumaResponse.image.source) {
                captionFormatted += `<br><a href="${kumaResponse.image.source}">${kumaResponse.image.referrer}</a>`;
            }

            try {
                const mxc = await matrix.uploadContentFromUrl(kumaResponse.image.url);
                console.log("uploaded file", mxc);

                if (supportedVideoFileTypes.includes(fileType!)) {
                    return await matrix.sendMessage(kumaResponse.channel_id, {
                        msgtype: "m.video",
                        url: mxc,
                        filename: fileName,
                        body: caption,
                        format: "org.matrix.custom.html",
                        formatted_body: captionFormatted
                    });
                }
                else {
                    return await matrix.sendMessage(kumaResponse.channel_id, {
                        msgtype: "m.image",
                        url: mxc,
                        filename: fileName,
                        body: caption,
                        format: "org.matrix.custom.html",
                        formatted_body: captionFormatted
                    });
                }
            } catch (e) {
                // too large, probably
                console.warn("Unable to send video or image", e);

                const fileName = kumaResponse.image.preview.split("/").pop();
                const mxc = await matrix.uploadContentFromUrl(kumaResponse.image.preview);
                console.log("uploaded file", mxc);

                return await matrix.sendMessage(kumaResponse.channel_id, {
                    msgtype: "m.image",
                    url: mxc,
                    filename: fileName,
                    body: caption,
                    format: "org.matrix.custom.html",
                    formatted_body: captionFormatted
                });
            }
        }
        else {
            return await matrix.sendText(kumaResponse.channel_id, kumaResponse.message);
        }
    } catch (e) {
        console.error("An exception was thrown while trying to send a Matrix message", e);
    }
}