import { BeforeInsert, PrimaryColumn } from 'typeorm';
import { createId } from '@paralleldrive/cuid2';

export abstract class CuidEntity {
  @PrimaryColumn('varchar')
  id!: string;

  @BeforeInsert()
  assignCuid(): void {
    if (!this.id) {
      this.id = createId();
    }
  }
}
