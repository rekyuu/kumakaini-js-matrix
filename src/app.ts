import {
    AutojoinRoomsMixin,
    MatrixAuth,
    MatrixClient,
    RustSdkCryptoStorageProvider,
    SimpleFsStorageProvider,
} from "matrix-bot-sdk";
import {StoreType} from "@matrix-org/matrix-sdk-crypto-nodejs";
import {KumaRequest} from "./models/kumaRequest.ts";
import {SourceSystem} from "./models/sourceSystem.ts";
import {UserAuthority} from "./models/userAuthority.ts";

const homeServerUrl = process.env.KUMA_MATRIX_HOMESERVER_URL;
const accessToken = process.env.KUMA_MATRIX_ACCESS_TOKEN;
const adminUsername = process.env.KUMA_MATRIX_ADMIN_USERNAME;

if (homeServerUrl === undefined) {
    console.error("KUMA_MATRIX_HOMESERVER_URL must be defined");
    process.exit(1);
}

if (accessToken === undefined)
{
    const username = process.env.KUMA_MATRIX_USERNAME;
    const password = process.env.KUMA_MATRIX_PASSWORD;

    if (username === undefined || password === undefined) {
        console.error("KUMA_MATRIX_USERNAME and KUMA_MATRIX_PASSWORD must be defined");
        process.exit(1);
    }

    const auth = new MatrixAuth(homeServerUrl);
    const authClient = await auth.passwordLogin(username, password);

    console.log(authClient.accessToken);

    process.exit(0);
}

const storage = new SimpleFsStorageProvider("storage.json");
const crypto = new RustSdkCryptoStorageProvider("./crypto", StoreType.Sqlite);
const client = new MatrixClient(homeServerUrl, accessToken, storage, crypto);
const userId = await client.getUserId();

AutojoinRoomsMixin.setupOnClient(client);
client.on("room.message", handleMessage);
client.on("room.invite", handleInvite);

// TODO: subscribe to redis

client.start().then(() => console.log(`Logged in as ${userId}`));

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

    const roomMembers = await client.getRoomMembers(roomId);

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

    // TODO: send to redis
}

async function handleInvite(roomId: string, inviteEvent: any) {
    if (inviteEvent["sender"] !== adminUsername) return;
    await client.joinRoom(roomId);
}

async function handleKumaResponse(response: string) {
    // TODO: handle redis responses
}