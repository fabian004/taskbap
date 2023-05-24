import express from 'express';
import taskRoutes from './routes/tasks';
import { sequelize } from './database';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const app = express();
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

const specs = swaggerJsdoc(options);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

app.use('/uploads', express.static('uploads'));

app.use('/tasks', taskRoutes);

sequelize.sync().then(() => {
  app.listen(port, () => {
    console.log(`App listening at http://localhost:${port}`);
  });
});