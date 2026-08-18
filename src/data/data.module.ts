import { Module } from '@nestjs/common';
import { createCrudController } from './crud.controller.factory';
import { ModelsController } from './models.controller';
import { ModelsService } from './models.service';

@Module({
  controllers: [
    ModelsController,
    createCrudController({ route: 'weight-files', modelKey: 'weightFile' }),
    createCrudController({ route: 'models', modelKey: 'model' }),
    createCrudController({ route: 'mmprojs', modelKey: 'mmproj' }),
    createCrudController({ route: 'draft-models', modelKey: 'draftModel' }),
    createCrudController({ route: 'diffusion-models', modelKey: 'diffusionModel' }),
    createCrudController({ route: 'quantized-models', modelKey: 'quantizedModel' }),
    createCrudController({ route: 'creators', modelKey: 'creator' }),
    createCrudController({ route: 'qors', modelKey: 'qor' }),
    createCrudController({ route: 'countries', modelKey: 'country' }),
    createCrudController({ route: 'launchers', modelKey: 'launcher' }),
    createCrudController({ route: 'launcher-versions', modelKey: 'launcherVersion' }),
  ],
  providers: [ModelsService],
})
export class DataModule {}