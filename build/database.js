"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sequelize = void 0;
const sequelize_typescript_1 = require("sequelize-typescript");
const Task_1 = __importDefault(require("./models/Task"));
const Log_1 = __importDefault(require("./models/Log"));
const User_1 = __importDefault(require("./models/User"));
const ShareWith_1 = __importDefault(require("./models/ShareWith"));
const File_1 = __importDefault(require("./models/File"));
exports.sequelize = new sequelize_typescript_1.Sequelize('mysql://root:WX7MTXiSqsWzocj4jMH5@containers-us-west-186.railway.app:7158/railway', {
    models: [Task_1.default, Log_1.default, User_1.default, ShareWith_1.default, File_1.default],
});
