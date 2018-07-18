declare module "newredis" {
    import { Logger } from "colourlogger";
    import { Socket } from "net";

    export class RedisConnection extends Logger {
        readonly config: RedisConnectionConfig;
        constructor(config?: RedisConnectionConfig);
        bindEndEvent(fn: () => void): void;
        execute(command: any[]): Promise<any>;
        getRawTCPConnection(): Socket;
        initialize(): Promise<void>;
    }

    export interface RedisConnectionConfig {
        dbNum?: number;
        host: string;
        password?: string;
        port?: number;
    }

    export class RedisConnectionPool extends Logger {
        constructor(config?: RedisConnectionPoolConfig);
        getConnection(): Promise<PoolConnection>;
        showPoolStatus(): void;
        emptyQueue(): void;
        readonly config: RedisConnectionPoolConfig;
    }

    export class PoolConnection extends Logger {
        constructor(config: RedisConnectionConfig);
        execute(command: any[]): Promise<any>;
        release(): void;
    }

    export interface RedisConnectionPoolConfig extends RedisConnectionConfig {
        connectionLimit?: number;
    }
}
