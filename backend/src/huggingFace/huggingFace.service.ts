import { HttpService } from "@nestjs/axios";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { firstValueFrom } from "rxjs";
import { InferenceClient } from "@huggingface/inference";

@Injectable()
export class HuggingFaceService {
    private readonly logger = new Logger(HuggingFaceService.name);
    private client: InferenceClient;
    private model = 'google/flan-t5-large';

    constructor(private configService: ConfigService) {
        const token = this.configService.get<string>('HF_TOKEN');
        this.client = new InferenceClient(token, { endpointUrl: 'https://api-inference.huggingface.co' });
    }

    /**
     * The `interpretCommand` function in TypeScript takes a natural language input, converts it into a
     * JSON format based on predefined actions, and handles error cases gracefully.
     * @param {string} naturalLanguage - The `naturalLanguage` parameter in the `interpretCommand`
     * function is a string that represents a user command or instruction given in natural language. The
     * function processes this natural language input and converts it into a JSON object with an action
     * and data based on predefined rules for task management operations such as create, read
     * @returns The `interpretCommand` function returns a Promise that resolves to an object containing
     * the action and data based on the natural language input provided. The output is in JSON format
     * following the structure defined in the prompt for different actions such as create, read, update,
     * delete, or unknown.
     */
    async interpretCommand(naturalLanguage: string): Promise<any> {
        // Few‑shot prompt to teach the model the expected output format
        const prompt = `
            you are a task manager. given a user command, output a JSON with an action and data.

            Possible actions: "create", "read", "update", "delete".
            For "create": {"action":"create", "data":{"title":"..."}}
            For "read": {"action":"read"}
            For "update": {"action":"update","data":{"id":<number>,"title":"..."}}
            For "delete": {"action":"delete","data":{"id":<number>}}
            For invalid commands: {"action":"unknown"}

            Examples:
            User: add a task buy milk
            JSON: {"action":"create","data":{"title":"buy milk"}}
            User: list all tasks
            JSON: {"action":"read"}
            User: change task 2 to buy coffee
            JSON: {"action":"update","data":{"id":2,"title":"buy coffee"}}
            User: remove task 3
            JSON: {"action":"delete","data":{"id":3}}

            Now convert this: ${naturalLanguage}
            JSON:
        `;

        try {
            const response = await this.client.textGeneration({
                model: this.model,
                inputs: prompt,
                parameters: {
                    max_new_tokens: 100,
                    return_full_text: false, // onlu get the generated part
                },
            })

            let generated = response.generated_text?.trim() ?? '';
            if (!generated) {
                this.logger.warn('Empty response from HF');
                return { action: 'unknown' };
            }

            // extract the first JSON object from the generated text
            const match = generated.match(/\{[\s\S]*\}/);
            if (match) {
                return JSON.parse(match[0]);
            }

            this.logger.warn(`Could not parse JSON from: ${generated}`);
            return { action: 'unknown' }
        } catch (error: any) {
            this.logger.error('HF API call failed', error);
            return { action: 'unknown' };
        }
    }
}