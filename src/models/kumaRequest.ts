import {SourceSystem} from "./sourceSystem.ts";
import {UserAuthority} from "./userAuthority.ts";

export class KumaRequest {
    username: string;
    message: string;
    source_system: SourceSystem;
    message_id?: string;
    user_authority: UserAuthority;
    channel_id?: string;
    channel_is_private: boolean;
    channel_is_nsfw: boolean;

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
        this.source_system = sourceSystem;
        this.message_id = messageId;
        this.user_authority = userAuthority;
        this.channel_id = channelId;
        this.channel_is_private = channelIsPrivate;
        this.channel_is_nsfw = channelIsNsfw;
    }
}
