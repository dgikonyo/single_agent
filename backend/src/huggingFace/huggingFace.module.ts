import { Module } from "@nestjs/common";
import { HuggingFaceService } from "./huggingFace.service";

@Module({
    providers: [HuggingFaceService],
    exports: [HuggingFaceService],
})
export class HuggingFaceModule { }