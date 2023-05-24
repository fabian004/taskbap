import { Sequelize } from 'sequelize-typescript';
import Task from './models/Task';
import Log from './models/Log'; 
import User from './models/User'; 
import ShareWith from './models/ShareWith'; 
import File from './models/File'; 

export const sequelize = new Sequelize('mysql://root:WX7MTXiSqsWzocj4jMH5@containers-us-west-186.railway.app:7158/railway', {
  models: [Task,Log,User,ShareWith,File],
});