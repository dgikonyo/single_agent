import { Module } from "@nestjs/common";
import { HuggingFaceModule } from "src/huggingFace/huggingFace.module";
import { TasksController } from "./tasks.controller";
import { TasksService } from "./tasks.service";

@Module({
    imports: [HuggingFaceModule],
    controllers: [TasksController],
    providers: [TasksService],
})
export class TasksModule { }