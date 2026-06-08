import { Body, Controller, Delete, Get, Param, Post, Put } from "@nestjs/common"
import { TasksService } from "./tasks.service";
import { HuggingFaceService } from "src/huggingFace/huggingFace.service";
import { Task } from "./entity/tasks.entity";

@Controller('tasks')
export class TasksController {
    constructor(private readonly taskService: TasksService,
        private readonly hfService: HuggingFaceService,
    ) { }

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
    async agentCommand(@Body('command') command: string): Promise<any> {
        const interpretation = await this.hfService.interpretCommand(command);
        let result: any = {};
        const action = interpretation.action;

        try {
            switch (action) {
                case 'create':
                    const newTask = this.taskService.create(interpretation.data.title);
                    result = { performed: 'create', task: newTask };
                    break;
                case 'read':
                    result = { performed: 'read', tasks: this.taskService.findAll() };
                    break;
                case 'update':
                    const updated = this.taskService.update(
                        interpretation.data.id,
                        interpretation.data.title,
                    );
                    result = updated ? { performed: 'update', task: updated } : { error: 'Task not found' };
                    break;
                case 'delete':
                    const deleted = this.taskService.remove(interpretation.data.id);
                    result = deleted ? { performed: 'delete', id: interpretation.data.id } : { error: 'Task not found' };
                    break;
                default:
                    result = {
                        error: 'Could not understand command. Try examples like "add a task buy milk".'
                    }
            }
        } catch { result = { error: 'Failed to execute command.' }; }

        return {
            command,
            interpretation,
            result
        }
    }
}