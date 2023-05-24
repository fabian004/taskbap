import { Model, Table, Column, DataType, PrimaryKey, AutoIncrement, AllowNull, ForeignKey } from 'sequelize-typescript';
import Task from './Task';
import User from './User';

@Table({ tableName: 'ShareWith', timestamps: false })
export default class ShareWith extends Model {

  @PrimaryKey
  @ForeignKey(() => Task)
  @Column(DataType.INTEGER)
  public task_id!: number;

  @PrimaryKey
  @ForeignKey(() => User)
  @Column(DataType.INTEGER)
  public user_id!: number;

}