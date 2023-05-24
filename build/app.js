"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const tasks_1 = __importDefault(require("./routes/tasks"));
const database_1 = require("./database");
const swagger_jsdoc_1 = __importDefault(require("swagger-jsdoc"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const app = (0, express_1.default)();
const port = 8080;
const options = {
    swaggerDefinition: {
        info: {
            title: 'Task-Api',
            description: 'API REST corporativo BAP',
            version: '1.0.0',
        },
    },
    apis: ['src/routes/*.ts'], // Ruta a tus archivos con comentarios Swagger
};
const specs = (0, swagger_jsdoc_1.default)(options);
app.use('/api-docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(specs));
app.use('/uploads', express_1.default.static('uploads'));
app.use('/tasks', tasks_1.default);
database_1.sequelize.sync().then(() => {
    app.listen(port, () => {
        console.log(`App listening at http://localhost:${port}`);
    });
});
