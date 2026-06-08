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

        if (!token) {
            throw new Error('HF_TOKEN is missing');
        }

        const endpoint = this.configService.get<string>('HF_ENDPOINT') || 'https://router.huggingface.co/v1';

        this.client = new InferenceClient(token, { endpointUrl: endpoint, });
        this.model = this.configService.get<string>('HF_MODEL') || 'Qwen/Qwen2.5-7B-Instruct';
    }

    async interpretCommand(command: string,): Promise<AgentResponse> {
        this.logger.log(this.healthCheck());
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

            const content = response.choices?.[0]?.message?.content ?? '';

            const json = this.extractJson(content);

            if (!json) {
                this.logger.warn(
                    `Could not extract JSON from model response: ${content}`,
                );

                return {
                    action: 'unknown',
                    confidence: 0,
                };
            }

            const parsed = AgentResponseSchema.safeParse(json);

            if (!parsed.success) {
                this.logger.warn(
                    `Invalid model response schema: ${JSON.stringify(
                        parsed.error.flatten(),
                    )}`,
                );

                return {
                    action: 'unknown',
                    confidence: 0,
                };
            }

            return parsed.data;
        } catch (error) {
            this.logger.error(
                'Hugging Face inference failed',
                error instanceof Error ? error.stack : String(error),
            );

            return {
                action: 'unknown',
                confidence: 0,
            };
        }
    }

    private buildSystemPrompt(): string {
        return `
            You are a task management command parser.

            Convert the user's command into JSON.

            Return ONLY valid JSON.

            Schema:

            {
            "action": "create|read|update|delete|unknown",
            "confidence": 0.0,
            "data": {}
            }

            Examples:

            User:
            add a task buy milk

            Output:
            {
            "action":"create",
            "confidence":0.99,
            "data":{
                "title":"buy milk"
            }
            }

            User:
            list all tasks

            Output:
            {
            "action":"read",
            "confidence":0.99,
            "data":{}
            }

            User:
            change task 2 to buy coffee

            Output:
            {
            "action":"update",
            "confidence":0.95,
            "data":{
                "id":2,
                "title":"buy coffee"
            }
            }

            User:
            remove task 3

            Output:
            {
            "action":"delete",
            "confidence":0.99,
            "data":{
                "id":3
            }
            }

            Rules:

            1. Return JSON only.
            2. No markdown.
            3. No explanation.
            4. No code fences.
            5. Always include confidence.
            6. If unsure, use:

            {
            "action":"unknown",
            "confidence":0
            }
        `;
    }

    private extractJson(text: string): unknown | null {
        try {
            return JSON.parse(text);
        } catch { }

        try {
            const fencedMatch = text.match(
                /```(?:json)?\s*([\s\S]*?)```/i,
            );

            if (fencedMatch?.[1]) {
                return JSON.parse(fencedMatch[1]);
            }
        } catch { }

        try {
            const objectMatch = text.match(/\{[\s\S]*\}/);

            if (objectMatch?.[0]) {
                return JSON.parse(objectMatch[0]);
            }
        } catch { }

        return null;
    }

    async healthCheck(): Promise<boolean> {
        try {
            const response = await this.client.chatCompletion({
                model: this.model,
                max_tokens: 5,
                temperature: 0,
                messages: [
                    {
                        role: 'user',
                        content: 'ping',
                    },
                ],
            });

            return !!response;
        } catch {
            return false;
        }
    }
}