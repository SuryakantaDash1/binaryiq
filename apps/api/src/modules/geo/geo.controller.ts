import { Controller, Get, Param } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { Public } from '../../common/decorators/public.decorator';
import { ValidationException } from '../../common/exceptions/domain.exception';

import { GeoService, type PincodeArea } from './geo.service';

@Controller('geo')
export class GeoController {
  constructor(private readonly geo: GeoService) {}

  /** Used by the registration form before the visitor has an account. */
  @Get('pincode/:pin')
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  pincode(@Param('pin') pin: string): Promise<PincodeArea[]> {
    if (!/^[1-9]\d{5}$/.test(pin)) throw new ValidationException('Enter a 6-digit PIN code');
    return this.geo.lookupPincode(pin);
  }
}
