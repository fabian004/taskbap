import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement, ForeignKey } from 'sequelize-typescript';
import Task from './Task';
import User from './User';

@Table({ tableName: 'Tags', timestamps: false })
export default class Tag extends Model {
  
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  public id!: number;

  @ForeignKey(() => Task)
  @Column(DataType.STRING)
  public task_id!: string;

  @ForeignKey(() => User)
  @Column(DataType.STRING)
  public user_id!: string;

  @Column(DataType.STRING)
  public tag!: string;

}