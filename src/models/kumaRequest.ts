import {SourceSystem} from "./sourceSystem.ts";
import {UserAuthority} from "./userAuthority.ts";

export class KumaRequest {
    username: string;
    message: string;
    sourceSystem: SourceSystem;
    messageId?: string;
    userAuthority: UserAuthority;
    channelId?: string;
    channelIsPrivate: boolean;
    channelIsNsfw: boolean;

    constructor(
        username: string,
        message: string,
        sourceSystem: SourceSystem = SourceSystem.Matrix,
        messageId: string | undefined = undefined,
        userAuthority: UserAuthority = UserAuthority.User,
        channelId: string | undefined = undefined,
        channelIsPrivate: boolean = false,
        channelIsNsfw: boolean = false) {
        this.username = username;
        this.message = message;
        this.sourceSystem = sourceSystem;
        this.messageId = messageId;
        this.userAuthority = userAuthority;
        this.channelId = channelId;
        this.channelIsPrivate = channelIsPrivate;
        this.channelIsNsfw = channelIsNsfw;
    }
}
