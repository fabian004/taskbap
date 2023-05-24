import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement, AllowNull } from 'sequelize-typescript';

@Table({ tableName: 'Files', timestamps: false })
export default class File extends Model {
  
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  public id!: number;

  @Column(DataType.STRING)
  public task_id!: string;

  @Column(DataType.STRING)
  public file_name!: string;

  @Column(DataType.STRING)
  public file_size!: string;

  @Column(DataType.STRING)
  public file_format!: string;

  @Column(DataType.STRING)
  public file_path!: string;

}