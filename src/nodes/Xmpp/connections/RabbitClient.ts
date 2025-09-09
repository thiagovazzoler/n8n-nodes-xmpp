import * as amqp from 'amqplib';

export interface RabbitConfig {
    url: string;
}

type AmqpConnection = any;
type AmqpChannel = any;
type ConsumeMessage = any;

export type QueueOptions = {
    durable?: boolean;
    exclusive?: boolean;
    autoDelete?: boolean;
    arguments?: Record<string, any>;
};

export class RabbitClient {
    private static instance: RabbitClient;
    private connection: AmqpConnection | null = null;
    private channel: AmqpChannel | null = null;

    private constructor() { }

    public static getInstance(): RabbitClient {
        if (!RabbitClient.instance)
            RabbitClient.instance = new RabbitClient();

        return RabbitClient.instance;
    }

    /** Conecta e cria canal (singleton por processo) */
    public async connect(config: RabbitConfig): Promise<AmqpChannel> {
        if (this.connection && this.channel) return this.channel;

        this.connection = await (amqp as any).connect(config.url);
        this.channel = await this.connection.createChannel();

        // se cair, zera refs para reconectar na próxima chamada
        this.connection.on('close', () => {
            this.connection = null;
            this.channel = null;
        });
        this.connection.on('error', () => {
            this.connection = null;
            this.channel = null;
        });

        return this.channel;
    }

    /** QoS/prefetch para o canal */
    public async setPrefetch(count: number) {
        if (!this.channel)
            throw new Error('RabbitMQ channel not initialized');

        await this.channel.prefetch(count);
    }

    /** Garante (verifica/cria) uma fila */
    public async ensureQueue(
        queueName: string,
        options: QueueOptions = { durable: true },
    ): Promise<void> {
        if (!this.channel)
            throw new Error('RabbitMQ channel not initialized');

        await this.channel.assertQueue(queueName, options);
    }

    /** Garante várias filas */
    public async ensureQueues(
        queueNames: string[],
        options: QueueOptions = { durable: true },
    ): Promise<void> {
        for (const q of queueNames)
            await this.ensureQueue(q, options);
    }

    /** Publica JSON em uma fila (cria se não existir) */
    public async publish(
        queueName: string,
        message: unknown,
        options: QueueOptions = { durable: true },
    ): Promise<void> {
        if (!this.channel)
            throw new Error('RabbitMQ channel not initialized');

        await this.channel.assertQueue(queueName, options);

        this.channel.sendToQueue(
            queueName,
            Buffer.from(JSON.stringify(message)),
            { persistent: true },
        );
    }

    /**
     * Consome mensagens de uma fila (cria se não existir).
     * Dê ack/nack no handler.
     */
    public async consume(
        queueName: string,
        onMessage: (msg: ConsumeMessage | null, ch: AmqpChannel) => void,
        options: QueueOptions = { durable: true },
    ): Promise<void> {
        if (!this.channel)
            throw new Error('RabbitMQ channel not initialized');

        await this.channel.assertQueue(queueName, options);

        await this.channel.consume(queueName, (msg: ConsumeMessage | null) =>
            onMessage(msg, this.channel!),
        );
    }

    /** Fecha canal e conexão */
    public async Set_Fechar_Conexao(): Promise<void> {
        if (this.channel) {
            try {
                await this.channel.close();
            } catch { }

            this.channel = null;
        }

        if (this.connection) {
            try {
                await this.connection.close();
            } catch { }

            this.connection = null;
        }
    }

    public Get_Rabbit_Url_Conexao(r: any): string {
        return r.method === 'url'
            ? String(r.url)
            : `${r.ssl ? 'amqps' : 'amqp'}://${encodeURIComponent(r.username)}:${encodeURIComponent(r.password || '')}@${r.host}:${r.port || 5672}/${encodeURIComponent(r.vhost || '/')}`;
    }
}