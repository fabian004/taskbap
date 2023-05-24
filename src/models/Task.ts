import { Model, Table, Column, DataType, PrimaryKey, AutoIncrement, AllowNull } from 'sequelize-typescript';

@Table({ tableName: 'Tasks', timestamps: false })
export default class Task extends Model<Task> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  public id!: number;

  @AllowNull(false)
  @Column(DataType.STRING)
  public title!: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  public description!: string;

  @AllowNull(false)
  @Column(DataType.BOOLEAN)
  public completion_status!: boolean;

  @AllowNull(false)
  @Column(DataType.DATE)
  public due_date!: Date;

  @AllowNull(false)
  @Column(DataType.BOOLEAN)
  public is_public!: boolean;

  @AllowNull(true)
  @Column(DataType.INTEGER)
  public created_by!: number;

  @AllowNull(true)
  @Column(DataType.INTEGER)
  public responsible!: number;

  @AllowNull(true)
  @Column(DataType.DATE)
  public created_at!: Date;

}