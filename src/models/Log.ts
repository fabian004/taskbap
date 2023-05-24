import { Table, Column, Model, DataType, ForeignKey, PrimaryKey, AutoIncrement } from 'sequelize-typescript';
import Task from './Task';
import User from './User';

@Table({ tableName: 'Logs', timestamps: false })
export default class Log extends Model {

  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  public id!: number;
  
  @ForeignKey(() => Task)
  @Column(DataType.INTEGER)
  public task_id!: number;

  @ForeignKey(() => User)
  @Column(DataType.INTEGER)
  public user_id!: number;

  @Column(DataType.STRING)
  public action!: string;

  @Column(DataType.DATE)
  public created_at!: Date;
}