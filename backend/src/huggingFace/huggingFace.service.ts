import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InferenceClient } from '@huggingface/inference';
import { z } from 'zod';

const AgentResponseSchema = z.object({
    action: z.enum([
        'create',
        'read',
        'update',
        'delete',
        'unknown',
    ]),
    confidence: z.number().min(0).max(1).default(0),
    data: z.record(z.string(), z.any()).optional(),
});

export type AgentResponse = z.infer<typeof AgentResponseSchema>;

@Injectable()
export class HuggingFaceService {
    private readonly logger = new Logger(HuggingFaceService.name);

    private readonly client: InferenceClient;
    private readonly model: string;

    constructor(private readonly configService: ConfigService) {
        const token = this.configService.get<string>('HF_TOKEN');
        const model = this.configService.get<string>('HF_MODEL');

        if (!token) {
            throw new Error('HF_TOKEN is missing');
        }

        if (!model) {
            throw new Error('HF_MODEL is missing');
        }

        this.client = new InferenceClient(token);
        this.model = model;

        this.logger.log(`Using HF model: ${this.model}`);
    }

    async interpretCommand(command: string): Promise<AgentResponse> {
        try {
            const response = await this.client.chatCompletion({
                model: this.model,
                temperature: 0,
                max_tokens: 200,
                messages: [
                    {
                        role: 'system',
                        content: this.buildSystemPrompt(),
                    },
                    {
                        role: 'user',
                        content: command,
                    },
                ],
            });

            const content =
                response.choices?.[0]?.message?.content?.trim() ?? '';

            this.logger.debug(`Model response: ${content}`);

            const json = this.extractJson(content);

            if (!json) {
                this.logger.warn(`Failed to parse JSON: ${content}`);

                return {
                    action: 'unknown',
                    confidence: 0,
                };
            }

            const parsed = AgentResponseSchema.safeParse(json);

            if (!parsed.success) {
                this.logger.warn(
                    JSON.stringify(parsed.error.flatten(), null, 2),
                );

                return {
                    action: 'unknown',
                    confidence: 0,
                };
            }

            return parsed.data;
        } catch (error: any) {
            this.logger.error(
                'HF inference failed',
                error?.stack || String(error),
            );

            console.error('Status:', error?.httpResponse?.status);
            console.error('Body:', error?.httpResponse?.body);
            console.error('Message:', error?.message);

            return {
                action: 'unknown',
                confidence: 0,
            };
        }
    }

    private buildSystemPrompt(): string {
        return `
            You are a task management command parser.

            Return ONLY valid JSON.

            Schema:
            {
            "action":"create|read|update|delete|unknown",
            "confidence":0.0,
            "data":{}
            }

            Examples:

            Input: add a task buy milk
            Output:
            {"action":"create","confidence":0.99,"data":{"title":"buy milk"}}

            Input: list all tasks
            Output:
            {"action":"read","confidence":0.99,"data":{}}

            Input: change task 2 to buy coffee
            Output:
            {"action":"update","confidence":0.95,"data":{"id":2,"title":"buy coffee"}}

            Input: remove task 3
            Output:
            {"action":"delete","confidence":0.99,"data":{"id":3}}

            Rules:
            - JSON only
            - No markdown
            - No explanations
            - No code fences
            - Always include confidence
            `;
    }

    private extractJson(text: string): unknown | null {
        try {
            return JSON.parse(text);
        } catch { }

        try {
            const match = text.match(/\{[\s\S]*\}/);

            if (match?.[0]) {
                return JSON.parse(match[0]);
            }
        } catch { }

        return null;
    }

    async healthCheck(): Promise<boolean> {
        try {
            await this.client.chatCompletion({
                model: this.model,
                messages: [
                    {
                        role: 'user',
                        content: 'ping',
                    },
                ],
                temperature: 0,
                max_tokens: 5,
            });

            return true;
        } catch {
            return false;
        }
    }
}