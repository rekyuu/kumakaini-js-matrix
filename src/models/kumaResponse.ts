import {SourceSystem} from "./sourceSystem.ts";
import {ResponseMedia} from "./responseMedia.ts";

export class KumaResponse {
    message: string;
    image?: ResponseMedia;
    source_system: SourceSystem;
    channel_id?: string;
    timestamp: Date = new Date(Date.now());

    constructor(
        message: string,
        image: ResponseMedia | undefined = undefined,
        sourceSystem: SourceSystem,
        channelId: string | undefined = undefined,
        timestamp: Date) {
        this.message = message;
        this.image = image;
        this.source_system = sourceSystem;
        this.channel_id = channelId;
        this.timestamp = timestamp;
    }
}