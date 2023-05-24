import express from 'express';
import { check, validationResult } from 'express-validator';
import Task from '../models/Task';
import Log from '../models/Log';
import File from '../models/File';
import ShareWith from '../models/ShareWith';
import { Sequelize } from 'sequelize-typescript';

import multer from 'multer';
const fs = require('fs');

const router = express.Router();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, new Date().toISOString().replace(/:/g, '-') + file.originalname);
  },
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (
    file.mimetype === 'application/pdf' ||
    file.mimetype === 'image/jpeg' ||
    file.mimetype === 'image/png'
  ) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, JPG, and PNG files are allowed.'));
  }
};

const upload = multer({ storage, fileFilter });


router.get('/', async (req, res) => {
  const page = req.query.page ? parseInt(req.query.page as string) : 1;
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
  const offset = (page - 1) * limit;
  const tasks = await Task.findAll({ 
    attributes: ['id', 'title', 'completion_status', 'due_date', 'is_public'], 
    //where: { is_public: true }, 
    limit, 
    offset,
  });
  
  const totalTasks = await Task.count({ where: { is_public: true } });
  
  res.json({
    tasks,
    totalTasks,
  });
});


router.get('/search', async (req, res) => {
  try {
    const { keyword, completion_status, is_public, due_date } = req.query;

    const tasks = await Task.findAll({
      attributes: {
        include: [
          [Sequelize.literal(`(
            ((CASE WHEN title LIKE '%${keyword}%' THEN 1 ELSE 0 END) * 6) +
            ((CASE WHEN description LIKE '%${keyword}%' THEN 1 ELSE 0 END) * 4) +
            (IF(completion_status = ${completion_status === 'true'}, 1, 0) * 3) +
            (IF(is_public = ${is_public === 'true'}, 1, 0) * 2) +
            ((SELECT COUNT(*) FROM ShareWith WHERE task_id = Task.id) * 1) +
            (IF(due_date <= '${due_date}', 1, 0)) +
            (IF(Files.file_format = 'application/pdf', 1, 0) * 0.5) 
          )`), 'score']
        ]
      },
      order: [ [Sequelize.literal('score'), 'DESC'] ],
    });

    res.json(tasks);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});



router.post('/',
  upload.single('taskFile'),
  async (req: any, res: any) => {

    if (typeof req.body.taskUsers === 'string') {
      try {
        req.body.taskUsers = JSON.parse(req.body.taskUsers);
      } catch (error) {
        return res.status(400).json({ errors: [{ msg: 'Invalid format for taskUsers' }] });
      }
    }
    [
      check('title').notEmpty().withMessage('Title is required'),
      check('description').notEmpty().withMessage('Description is required'),
      check('completion_status').isBoolean().withMessage('Completion status must be a boolean'),
      check('due_date').isDate().withMessage('Due date must be a valid date'),
      check('is_public').isBoolean().withMessage('Is_public must be a boolean'),
      check('created_by').isInt().withMessage('Created_by must be an integer'),
      check('taskUsers').isArray().withMessage('taskUsers must be an array of user ids'),
      check('responsible').optional().isInt().custom((value, { req }) => {
        if (req.body.taskUsers && !req.body.taskUsers.includes(value)) {
          throw new Error('Responsible must be in the taskUsers array');
        }
        return true;
      }).withMessage('Responsible must be an integer'),
    ].forEach(validation => validation.run(req));

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const task = await Task.create(req.body);
      const taskUsers = req.body.taskUsers;
      
      for (let userId of taskUsers) {
        await ShareWith.create({ task_id: task.id, user_id: userId });
      }

      if (req.file) {
        const file = {
          task_id: task.id,
          file_name: req.file.filename,
          file_size: req.file.size,
          file_format: req.file.mimetype,
          file_path: req.file.path
        };
        await File.create(file);
      }

      await logAction(task.id, req.body.created_by, 'Task created number '+ task.id);
      res.json(task);
    } catch (err) {
      console.error(err);
      res.status(500).send('Server error');
    }
  }
);

router.put('/:id',
  upload.single('taskFile'), 
  async (req: any, res: any) => {

    if (typeof req.body.taskUsers === 'string') {
      try {
        req.body.taskUsers = JSON.parse(req.body.taskUsers);
      } catch (error) {
        return res.status(400).json({ errors: [{ msg: 'Invalid format for taskUsers' }] });
      }
    }
    [
      check('title').notEmpty().withMessage('Title is required'),
      check('description').notEmpty().withMessage('Description is required'),
      check('completion_status').isBoolean().withMessage('Completion status must be a boolean'),
      check('due_date').isDate().withMessage('Due date must be a valid date'),
      check('is_public').isBoolean().withMessage('Is_public must be a boolean'),
      check('taskUsers').isArray().withMessage('taskUsers must be an array of user ids'),
      check('responsible').optional().isInt().custom((value, { req }) => {
        if (req.body.taskUsers && !req.body.taskUsers.includes(value)) {
          throw new Error('Responsible must be in the taskUsers array');
        }
        return true;
      }).withMessage('Responsible must be an integer'),
    ].forEach(validation => validation.run(req)); 

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const task = await Task.findByPk(req.params.id);
      if (!task) {
        return res.status(404).send('Task not found');
      }

      // Check if task is public or if task has been shared with the user
      if (!task.is_public) {
        const shared = await ShareWith.findOne({ where: { task_id: task.id, user_id: req.body.userId } });
        if (!shared) {
          return res.status(403).send('Forbidden: User does not have permission to edit this task');
        }
      }

      task.title = req.body.title;
      task.description = req.body.description;
      task.completion_status = req.body.completion_status;
      task.due_date = req.body.due_date;
      task.is_public = req.body.is_public;

      await task.save();

      // Delete all existing ShareWith records for this task
      await ShareWith.destroy({ where: { task_id: task.id } });

      // Create new ShareWith records
      const taskUsers = req.body.taskUsers;
      for (let userId of taskUsers) {
        await ShareWith.create({ task_id: task.id, user_id: userId });
      }

      // Delete the previous file associated with the task
      if (req.file) {
        const existingFile = await File.findOne({ where: { task_id: task.id } });
        if (existingFile) {
          fs.unlink(existingFile.file_path, (err:any) => {
            if (err) {
              console.error(err);
            }
          });
          await existingFile.destroy();
        }

        const file = {
          task_id: task.id,
          file_name: req.file.filename,
          file_size: req.file.size,
          file_format: req.file.mimetype,
          file_path: req.file.path,
        };
        await File.create(file);
      }

      await logAction(task.id, req.body.userId, 'Task updated number ' + task.id);
      res.json(task);
    } catch (err) {
      console.error(err);
      res.status(500).send('Server error');
    }
  }
);


router.delete('/:id', async (req, res) => {
  const task = await Task.findByPk(req.params.id);
  if (task) {
    await task.destroy();
    await logAction(task.id, req.body.userId, 'Task deleted number '+task.id,true);
    res.json({ message: 'Task deleted' });
  } else {
    res.status(404).send('Task not found');
  }
});

async function logAction(task_id: number, user_id: number, action: string, deleted:boolean=false) {
  if(deleted){
    await Log.create({ user_id, action, created_at: new Date() });
  }else{
    await Log.create({ task_id, user_id, action, created_at: new Date() });
  }
  
}

export default router;


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
 * /tasks/search:
 *   get:
 *     summary: Buscar tareas
 *     description: Busca tareas basándose en distintos criterios.
 *     parameters:
 *       - name: keyword
 *         in: query
 *         description: Palabra clave para buscar en títulos y descripciones
 *         required: false
 *         schema:
 *           type: string
 *       - name: completion_status
 *         in: query
 *         description: Estatus de completado de la tarea
 *         required: false
 *         schema:
 *           type: boolean
 *       - name: is_public
 *         in: query
 *         description: Si la tarea es pública o no
 *         required: false
 *         schema:
 *           type: boolean
 *       - name: due_date
 *         in: query
 *         description: Fecha de vencimiento de la tarea
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Búsqueda exitosa
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   title:
 *                     type: string
 *                   completion_status:
 *                     type: boolean
 *                   due_date:
 *                     type: string
 *                     format: date
 *                   is_public:
 *                     type: boolean
 *                   score:
 *                     type: integer
 *       500:
 *         description: Error en el servidor
 */

/**
 * @swagger
 * /tasks:
 *   post:
 *     summary: Crear una nueva tarea
 *     description: Crea una nueva tarea y la asocia con un archivo y usuarios compartidos
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
 *         in: query
 *         description: Archivo asociado a la tarea
 *         required: true
 *         schema:
 *           type: string
 *           format: binary
 *     responses:
 *       200:
 *         description: Tarea creada exitosamente
 *       400:
 *         description: Formato inválido de taskUsers
 *       500:
 *         description: Error en el servidor
 */

/**
 * @swagger
 * /tasks/{id}:
 *   put:
 *     summary: Actualizar una tarea
 *     description: Actualiza una tarea y su asociación con un archivo y usuarios compartidos
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
 *         in: query
 *         description: Archivo asociado a la tarea
 *         required: true
 *         schema:
 *           type: string
 *           format: binary
 *     responses:
 *       200:
 *         description: Tarea actualizada exitosamente
 *       400:
 *         description: ID de la tarea o formato inválido de taskUsers
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