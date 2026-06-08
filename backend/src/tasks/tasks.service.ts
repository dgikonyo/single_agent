import { Injectable } from "@nestjs/common";
import { Task } from "./entity/tasks.entity";

@Injectable()
export class TasksService {
    private tasks: Task[] = [];
    private nextId = 1;

    create(title: string): Task {
        const newTask: Task = { id: this.nextId++, title, completed: false };
        this.tasks.push(newTask);
        return newTask;
    }

    findAll(): Task[] {
        return this.tasks;
    }

    update(id: number, title: string): Task | undefined {
        const task = this.tasks.find((t) => t.id === id);
        if (!task) {
            return undefined;
        }

        task.title = title;
        return task;
    }

    remove(id: number): boolean {
        const index = this.tasks.findIndex((t) => t.id === id);
        if (index === -1) {
            return false;
        }

        this.tasks.splice(index, 1);
        return true;
    }
}
