import { Body, Controller, Delete, Get, Param, Post, Put } from "@nestjs/common"
import { TasksService } from "./tasks.service";
import { HuggingFaceService } from "src/huggingFace/huggingFace.service";
import { Task } from "./entity/tasks.entity";

@Controller('tasks')
export class TasksController {
    constructor(private readonly taskService: TasksService,
        private readonly hfService: HuggingFaceService, ) { }

    @Post()
    createManually(@Body('title') title: string): Task {
        return this.taskService.create(title);
    }

    @Get()
    findAll(): Task[] {
        return this.taskService.findAll();
    }

    @Put(':id')
    updateManually(@Param('id') id: string, @Body('title') title: string): Task | undefined {
        const numericId = parseInt(id, 10);
        return this.taskService.update(numericId, title);
    }

    @Delete('id')
    removeManually(@Param('id') id: string): { success: boolean } {
        return { success: this.taskService.remove(parseInt(id, 10)) }
    }

    //Single Agent endpoint
    /* This `agentCommand` method in the `TasksController` class is an endpoint for handling commands
    related to task management using a natural language processing (NLP) service provided by
    `HuggingFaceService`. Here's a breakdown of what the method does: */
    @Post('agent')
    async agentCommand(@Body('command') command: string) {
        if (!command?.trim()) {
            return {
                error: 'Command is required',
            };
        }

        const interpretation =
            await this.hfService.interpretCommand(command);

        const { action, data } = interpretation;

        let result: any;

        try {
            switch (action) {
                case 'create': {
                    if (!data?.title) {
                        throw new Error('Missing title');
                    }

                    const task = await this.taskService.create(data.title);

                    result = {
                        performed: 'create',
                        task,
                    };

                    break;
                }

                case 'read': {
                    const tasks = await this.taskService.findAll();

                    result = {
                        performed: 'read',
                        tasks,
                    };

                    break;
                }

                case 'update': {
                    if (!data?.id || !data?.title) {
                        throw new Error('Missing id or title');
                    }

                    const task = await this.taskService.update(
                        Number(data.id),
                        data.title,
                    );

                    result = task ? { performed: 'update', task, } : { error: 'Task not found', };

                    break;
                }

                case 'delete': {
                    if (!data?.id) {
                        throw new Error('Missing id');
                    }

                    const deleted = await this.taskService.remove(
                        Number(data.id),
                    );

                    result = deleted
                        ? { performed: 'delete', id: Number(data.id), } : { error: 'Task not found', };

                    break;
                }

                default:
                    result = {
                        error: 'Could not understand command. Example: "add a task buy milk"',
                    };
            }
        } catch (error: any) {
            result = {
                error: error.message || 'Failed to execute command',
            };
        }

        return {
            command,
            interpretation,
            result,
        };
    }
}