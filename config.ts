import { type } from '@colyseus/schema';

class Config {
    @type("string")
    host = process.env.HOST || "0.0.0.0";
    @type("number")
    port = process.env.PORT || 80;
}

const classToExport = new Config();

export const config = classToExport;