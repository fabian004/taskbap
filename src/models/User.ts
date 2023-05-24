import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement, AllowNull } from 'sequelize-typescript';

@Table({ tableName: 'Users', timestamps: false })
export default class User extends Model<User> {
  
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  public id!: number;

  @AllowNull(false)
  @Column(DataType.STRING)
  public username!: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  public password!: string;

  @AllowNull
  @Column(DataType.DATE)
  public created_at!: Date;

}