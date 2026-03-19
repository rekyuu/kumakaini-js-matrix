export class ResponseMedia {
    url: string;
    preview: string;
    source: string;
    description: string;
    referrer: string;

    constructor(
        url: string,
        preview: string,
        source: string,
        description: string,
        referrer: string) {
        this.url = url;
        this.preview = preview;
        this.source = source;
        this.description = description;
        this.referrer = referrer;
    }
}