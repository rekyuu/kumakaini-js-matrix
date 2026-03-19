import {SourceSystem} from "./sourceSystem.ts";
import {ResponseMedia} from "./responseMedia.ts";

export class KumaResponse {
    message: string;
    media?: ResponseMedia;
    sourceSystem: SourceSystem;
    channelId?: string;
    timestamp: Date = new Date(Date.now());

    constructor(
        message: string,
        media: ResponseMedia | undefined = undefined,
        sourceSystem: SourceSystem,
        channelId: string | undefined = undefined,
        timestamp: Date) {
        this.message = message;
        this.media = media;
        this.sourceSystem = sourceSystem;
        this.channelId = channelId;
        this.timestamp = timestamp;
    }
}