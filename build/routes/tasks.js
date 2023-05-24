"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_validator_1 = require("express-validator");
const Task_1 = __importDefault(require("../models/Task"));
const Log_1 = __importDefault(require("../models/Log"));
const File_1 = __importDefault(require("../models/File"));
const ShareWith_1 = __importDefault(require("../models/ShareWith"));
const Comment_1 = __importDefault(require("../models/Comment"));
const Tag_1 = __importDefault(require("../models/Tag"));
const sequelize_typescript_1 = require("sequelize-typescript");
const multer_1 = __importDefault(require("multer"));
const fs = require('fs');
const router = express_1.default.Router();
const storage = multer_1.default.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, new Date().toISOString().replace(/:/g, '-') + file.originalname);
    },
});
const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'application/pdf' ||
        file.mimetype === 'image/jpeg' ||
        file.mimetype === 'image/png') {
        cb(null, true);
    }
    else {
        cb(new Error('Invalid file type. Only PDF, JPG, and PNG files are allowed.'));
    }
};
const upload = (0, multer_1.default)({ storage, fileFilter });
router.get('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const page = req.query.page ? parseInt(req.query.page) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 10;
    const offset = (page - 1) * limit;
    const tasks = yield Task_1.default.findAll({
        attributes: ['id', 'title', 'completion_status', 'due_date', 'is_public'],
        //where: { is_public: true }, 
        limit,
        offset,
    });
    const totalTasks = yield Task_1.default.count({ where: { is_public: true } });
    res.json({
        tasks,
        totalTasks,
    });
}));
router.get('/find', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const id = parseInt(req.query.id);
    if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ID format" });
    }
    const task = yield Task_1.default.findOne({
        where: {
            id: id
        }
    });
    if (!task) {
        return res.status(404).json({ message: "Task not found" });
    }
    const files = yield File_1.default.findAll({
        where: {
            task_id: task.id
        }
    });
    const tags = yield Tag_1.default.findAll({
        where: {
            task_id: task.id
        }
    });
    const comments = yield Comment_1.default.findAll({
        where: {
            task_id: task.id
        }
    });
    res.json({
        task: task,
        files: files,
        tags: tags,
        comments: comments
    });
}));
router.get('/search', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { keyword, completion_status, is_public, due_date } = req.query;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        const scoreConditions = [
            `(CASE WHEN title LIKE '%${keyword}%' THEN 1 ELSE 0 END) * 6`,
            `(CASE WHEN description LIKE '%${keyword}%' THEN 1 ELSE 0 END) * 4`,
        ];
        if (completion_status !== undefined) {
            scoreConditions.push(`IF(completion_status = ${completion_status === 'true'}, 1, 0) * 3`);
        }
        if (is_public !== undefined) {
            scoreConditions.push(`IF(is_public = ${is_public === 'true'}, 1, 0) * 2`);
        }
        if (due_date !== undefined) {
            scoreConditions.push(`IF(due_date <= '${due_date}', 1, 0)`);
        }
        const tasks = yield Task_1.default.findAll({
            attributes: {
                include: [
                    [sequelize_typescript_1.Sequelize.literal(`(
            (${scoreConditions.join(' + ')}) +
            ((SELECT COUNT(*) FROM ShareWith WHERE task_id = Task.id) * 1) +
            ((SELECT COUNT(*) FROM Files WHERE task_id = Task.id AND file_format = 'application/pdf') * 0.5) 
          )`), 'score']
                ]
            },
            order: [[sequelize_typescript_1.Sequelize.literal('score'), 'DESC']],
            limit,
            offset,
        });
        const totalTasks = yield Task_1.default.count({
            attributes: {
                include: [
                    [sequelize_typescript_1.Sequelize.literal(`(
            (${scoreConditions.join(' + ')}) +
            ((SELECT COUNT(*) FROM ShareWith WHERE task_id = Task.id) * 1) +
            ((SELECT COUNT(*) FROM Files WHERE task_id = Task.id AND file_format = 'application/pdf') * 0.5) 
          )`), 'score']
                ]
            }
        });
        res.json({
            tasks,
            totalTasks,
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
}));
router.post('/', upload.single('taskFile'), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (typeof req.body.sharedWith === 'string') {
        try {
            req.body.sharedWith = JSON.parse(req.body.sharedWith);
        }
        catch (error) {
            return res.status(400).json({ errors: [{ msg: 'Invalid format for sharedWith' }] });
        }
    }
    [
        (0, express_validator_1.check)('title').notEmpty().withMessage('Title is required'),
        (0, express_validator_1.check)('description').notEmpty().withMessage('Description is required'),
        (0, express_validator_1.check)('completion_status').isBoolean().withMessage('Completion status must be a boolean'),
        (0, express_validator_1.check)('due_date').isDate().withMessage('Due date must be a valid date'),
        (0, express_validator_1.check)('is_public').isBoolean().withMessage('Is_public must be a boolean'),
        (0, express_validator_1.check)('created_by').isInt().withMessage('Created_by must be an integer'),
        (0, express_validator_1.check)('sharedWith').isArray().withMessage('sharedWith must be an array of user ids'),
        (0, express_validator_1.check)('responsible').optional().isInt().custom((value, { req }) => {
            if (req.body.sharedWith && !req.body.sharedWith.includes(value)) {
                throw new Error('Responsible must be in the sharedWith array');
            }
            return true;
        }).withMessage('Responsible must be an integer'),
    ].forEach(validation => validation.run(req));
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    try {
        const task = yield Task_1.default.create(req.body);
        const sharedWith = req.body.sharedWith;
        for (let userId of sharedWith) {
            yield ShareWith_1.default.create({ task_id: task.id, user_id: userId });
        }
        if (req.body.comments) {
            yield Comment_1.default.create({ task_id: task.id, user_id: req.body.userId, comment: req.body.comments });
        }
        if (req.body.tags) {
            yield Tag_1.default.create({ task_id: task.id, user_id: req.body.userId, tag: req.body.tags });
        }
        if (req.file) {
            const file = {
                task_id: task.id,
                file_name: req.file.filename,
                file_size: req.file.size,
                file_format: req.file.mimetype,
                file_path: req.file.path
            };
            yield File_1.default.create(file);
        }
        yield logAction(task.id, req.body.created_by, 'Task created number ' + task.id);
        res.json(task);
    }
    catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
}));
router.put('/:id', upload.single('taskFile'), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (typeof req.body.sharedWith === 'string') {
        try {
            req.body.sharedWith = JSON.parse(req.body.sharedWith);
        }
        catch (error) {
            return res.status(400).json({ errors: [{ msg: 'Invalid format for sharedWith' }] });
        }
    }
    [
        (0, express_validator_1.check)('title').notEmpty().withMessage('Title is required'),
        (0, express_validator_1.check)('description').notEmpty().withMessage('Description is required'),
        (0, express_validator_1.check)('completion_status').isBoolean().withMessage('Completion status must be a boolean'),
        (0, express_validator_1.check)('due_date').isDate().withMessage('Due date must be a valid date'),
        (0, express_validator_1.check)('is_public').isBoolean().withMessage('Is_public must be a boolean'),
        (0, express_validator_1.check)('sharedWith').optional().isArray().withMessage('sharedWith must be an array of user ids'),
        (0, express_validator_1.check)('responsible').optional().notEmpty().withMessage('Responsible is optional'),
        (0, express_validator_1.check)('tags').optional().notEmpty().withMessage('Tags are optional'),
        (0, express_validator_1.check)('taskFile').optional().custom((value, { req }) => {
            if (req.file && ['application/pdf', 'image/png', 'image/jpeg'].includes(req.file.mimetype) && req.file.size <= 5000000) {
                return true;
            }
            throw new Error('File must be a .pdf, .png, or .jpg and not larger than 5MB');
        }),
    ].forEach(validation => validation.run(req));
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    try {
        const task = yield Task_1.default.findByPk(req.params.id);
        if (!task) {
            return res.status(404).send('Task not found');
        }
        // Check if task is public or if task has been shared with the user
        if (!task.is_public) {
            const shared = yield ShareWith_1.default.findOne({ where: { task_id: task.id, user_id: req.body.userId } });
            if (!shared) {
                return res.status(403).send('Forbidden: User does not have permission to edit this task');
            }
        }
        task.title = req.body.title;
        task.description = req.body.description;
        task.completion_status = req.body.completion_status;
        task.due_date = req.body.due_date;
        task.is_public = req.body.is_public;
        yield task.save();
        // Delete all existing ShareWith records for this task
        yield ShareWith_1.default.destroy({ where: { task_id: task.id } });
        // Create new ShareWith records
        const sharedWith = req.body.sharedWith;
        for (let userId of sharedWith) {
            yield ShareWith_1.default.create({ task_id: task.id, user_id: userId });
        }
        if (req.body.comments) {
            yield Comment_1.default.create({ task_id: task.id, user_id: req.body.userId, comment: req.body.comments });
        }
        if (req.body.tags) {
            yield Tag_1.default.create({ task_id: task.id, user_id: req.body.userId, tag: req.body.tags });
        }
        // Delete the previous file associated with the task
        if (req.file) {
            const existingFile = yield File_1.default.findOne({ where: { task_id: task.id } });
            if (existingFile) {
                fs.unlink(existingFile.file_path, (err) => {
                    if (err) {
                        console.error(err);
                    }
                });
                yield existingFile.destroy();
            }
            const file = {
                task_id: task.id,
                file_name: req.file.filename,
                file_size: req.file.size,
                file_format: req.file.mimetype,
                file_path: req.file.path,
            };
            yield File_1.default.create(file);
        }
        yield logAction(task.id, req.body.userId, 'Task updated number ' + task.id);
        res.json(task);
    }
    catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
}));
router.delete('/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const task = yield Task_1.default.findByPk(req.params.id);
    if (task) {
        yield task.destroy();
        yield logAction(task.id, 1, 'Task deleted number ' + task.id, true);
        res.json({ message: 'Task deleted' });
    }
    else {
        res.status(404).send('Task not found');
    }
}));
function logAction(task_id, user_id, action, deleted = false) {
    return __awaiter(this, void 0, void 0, function* () {
        if (deleted) {
            yield Log_1.default.create({ user_id, action, created_at: new Date() });
        }
        else {
            yield Log_1.default.create({ task_id, user_id, action, created_at: new Date() });
        }
    });
}
exports.default = router;
/**
 * @swagger
 * /tasks:
 *   get:
 *     summary: Obtener todas las tareas
 *     description: Obtiene información sobre todas las tareas disponibles.
 *     parameters:
 *       - name: page
 *         in: query
 *         description: Número de página
 *         required: false
 *         schema:
 *           type: integer
 *       - name: limit
 *         in: query
 *         description: Límite de resultados por página
 *         required: false
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Respuesta exitosa
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tasks:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       title:
 *                         type: string
 *                       completion_status:
 *                         type: boolean
 *                       due_date:
 *                         type: string
 *                         format: date
 *                       is_public:
 *                         type: boolean
 *                 totalTasks:
 *                   type: integer
 */
/**
 * @swagger
 * /tasks/find:
 *   get:
 *     summary: Buscar una tarea específica
 *     description: Busca una tarea basada en los criterios de búsqueda proporcionados.
 *     parameters:
 *       - name: id
 *         in: query
 *         description: Id de búsqueda de la tarea
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Respuesta exitosa
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 task:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     title:
 *                       type: string
 *                     completion_status:
 *                       type: boolean
 *                     due_date:
 *                       type: string
 *                       format: date
 *                     is_public:
 *                       type: boolean
 *                 files:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       name:
 *                         type: string
 *                       task_id:
 *                         type: integer
 *                 tags:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       name:
 *                         type: string
 *                       task_id:
 *                         type: integer
 *                 comments:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       text:
 *                         type: string
 *                       task_id:
 *                         type: integer
 *       400:
 *         description: ID de formato inválido
 *       404:
 *         description: Tarea no encontrada
 *       500:
 *         description: Error en el servidor
 */
/**
 * @swagger
 * /tasks/search:
 *   get:
 *     summary: Buscar tareas
 *     description: Busca tareas basadas en los criterios de búsqueda proporcionados.
 *     parameters:
 *       - name: keyword
 *         in: query
 *         description: Palabra clave para buscar en el título y la descripción de las tareas.
 *         required: false
 *         schema:
 *           type: string
 *       - name: completion_status
 *         in: query
 *         description: Estado de finalización de las tareas (true o false).
 *         required: false
 *         schema:
 *           type: boolean
 *       - name: is_public
 *         in: query
 *         description: Indica si las tareas son públicas (true o false).
 *         required: false
 *         schema:
 *           type: boolean
 *       - name: due_date
 *         in: query
 *         description: Fecha límite de las tareas (en formato 'yyyy-mm-dd').
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *       - name: page
 *         in: query
 *         description: Número de página de resultados.
 *         required: false
 *         schema:
 *           type: integer
 *       - name: limit
 *         in: query
 *         description: Número máximo de tareas por página.
 *         required: false
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Respuesta exitosa
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tasks:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       title:
 *                         type: string
 *                       completion_status:
 *                         type: boolean
 *                       due_date:
 *                         type: string
 *                         format: date
 *                       is_public:
 *                         type: boolean
 *                 totalTasks:
 *                   type: integer
 *       404:
 *         description: Tareas no encontradas
 *       500:
 *         description: Error en el servidor
 */
/**
 * @swagger
 * /tasks:
 *   post:
 *     summary: Crear una nueva tarea
 *     description: Crea una nueva tarea y la asocia con un archivo, usuarios compartidos, comentarios y etiquetas
 *     parameters:
 *       - name: title
 *         in: query
 *         description: Título de la tarea
 *         required: true
 *         schema:
 *           type: string
 *       - name: description
 *         in: query
 *         description: Descripción de la tarea
 *         required: true
 *         schema:
 *           type: string
 *       - name: completion_status
 *         in: query
 *         description: Estado de completitud de la tarea
 *         required: true
 *         schema:
 *           type: boolean
 *       - name: due_date
 *         in: query
 *         description: Fecha de vencimiento de la tarea
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - name: is_public
 *         in: query
 *         description: Indica si la tarea es pública
 *         required: true
 *         schema:
 *           type: boolean
 *       - name: created_by
 *         in: query
 *         description: ID del usuario que crea la tarea
 *         required: true
 *         schema:
 *           type: integer
 *       - name: taskUsers
 *         in: query
 *         description: Array de IDs de usuarios asociados a la tarea
 *         required: false
 *         schema:
 *           type: array
 *           items:
 *             type: integer
 *       - name: responsible
 *         in: query
 *         description: ID del usuario responsable de la tarea
 *         required: false
 *         schema:
 *           type: integer
 *       - name: taskFile
 *         in: query
 *         description: Archivo asociado a la tarea
 *         required: false
 *         schema:
 *           type: string
 *           format: binary
 *       - name: comments
 *         in: query
 *         description: Comentarios asociados a la tarea
 *         required: false
 *         schema:
 *           type: string
 *       - name: tags
 *         in: query
 *         description: Etiquetas asociadas a la tarea
 *         required: false
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Tarea creada exitosamente
 *       '400':
 *         description: Formato inválido de taskUsers o parámetros faltantes
 *       '500':
 *         description: Error en el servidor
 */
/**
 * @swagger
 * /tasks/{id}:
 *   put:
 *     summary: Actualizar una tarea
 *     description: Actualiza una tarea y su asociación con un archivo, usuarios compartidos, comentarios y etiquetas
 *     parameters:
 *       - name: id
 *         in: path
 *         description: ID de la tarea a actualizar
 *         required: true
 *         schema:
 *           type: integer
 *       - name: title
 *         in: query
 *         description: Título de la tarea
 *         required: true
 *         schema:
 *           type: string
 *       - name: description
 *         in: query
 *         description: Descripción de la tarea
 *         required: true
 *         schema:
 *           type: string
 *       - name: completion_status
 *         in: query
 *         description: Estado de completitud de la tarea
 *         required: true
 *         schema:
 *           type: boolean
 *       - name: due_date
 *         in: query
 *         description: Fecha de vencimiento de la tarea
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - name: is_public
 *         in: query
 *         description: Indica si la tarea es pública
 *         required: true
 *         schema:
 *           type: boolean
 *       - name: created_by
 *         in: query
 *         description: ID del usuario que crea la tarea
 *         required: true
 *         schema:
 *           type: integer
 *       - name: taskUsers
 *         in: query
 *         description: Array de IDs de usuarios asociados a la tarea
 *         required: true
 *         schema:
 *           type: array
 *           items:
 *             type: integer
 *       - name: responsible
 *         in: query
 *         description: ID del usuario responsable de la tarea
 *         required: true
 *         schema:
 *           type: integer
 *       - name: taskFile
 *         in: formData
 *         description: Archivo asociado a la tarea
 *         required: true
 *         schema:
 *           type: file
 *       - name: comments
 *         in: query
 *         description: Comentarios asociados a la tarea
 *         required: false
 *         schema:
 *           type: string
 *       - name: tags
 *         in: query
 *         description: Etiquetas asociadas a la tarea
 *         required: false
 *         schema:
 *           type: string
 *     consumes:
 *       - multipart/form-data
 *     responses:
 *       200:
 *         description: Tarea actualizada exitosamente
 *       400:
 *         description: ID de la tarea o formato inválido de taskUsers
 *       403:
 *         description: No tiene permiso para editar esta tarea
 *       404:
 *         description: Tarea no encontrada
 *       500:
 *         description: Error en el servidor
 */
/**
 * @swagger
 * /tasks/{id}:
 *   delete:
 *     summary: Eliminar una tarea
 *     description: Elimina una tarea por su ID
 *     parameters:
 *       - name: id
 *         in: path
 *         description: ID de la tarea a eliminar
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Tarea eliminada exitosamente
 *       404:
 *         description: Tarea no encontrada
 */ 
