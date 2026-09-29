import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { CuidEntity } from './cuid-base.entity';
import type { Role } from './role.entity';

@Entity('role_permissions')
@Unique(['roleId', 'permission'])
export class RolePermission extends CuidEntity {
  @Column({ type: 'varchar' })
  roleId!: string;

  @Column({ type: 'varchar' })
  permission!: string;

  @ManyToOne('Role', 'permissions', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'roleId' })
  role!: Role;
}
