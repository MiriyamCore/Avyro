import { BadRequestException, Injectable } from '@nestjs/common';
import { prisma } from '@avyro/database';

@Injectable()
export class FxService {
  listCurrencies(organizationId: string) {
    return prisma.currency.findMany({
      where: { organizationId, active: true },
      include: {
        rates: { orderBy: { rateDate: 'desc' }, take: 1 },
      },
      orderBy: { code: 'asc' },
    });
  }

  async ensureDefaults(organizationId: string) {
    const defaults = [
      { code: 'BDT', name: 'Bangladeshi Taka', symbol: '৳', isBase: true },
      { code: 'GBP', name: 'British Pound', symbol: '£', isBase: false },
      { code: 'USD', name: 'US Dollar', symbol: '$', isBase: false },
      { code: 'EUR', name: 'Euro', symbol: '€', isBase: false },
    ];
    for (const row of defaults) {
      await prisma.currency.upsert({
        where: {
          organizationId_code: { organizationId, code: row.code },
        },
        update: { name: row.name, symbol: row.symbol, isBase: row.isBase },
        create: { organizationId, ...row },
      });
    }
    return this.listCurrencies(organizationId);
  }

  listRates(organizationId: string, currencyCode?: string) {
    return prisma.exchangeRate.findMany({
      where: {
        organizationId,
        ...(currencyCode
          ? { currency: { code: currencyCode } }
          : {}),
      },
      include: { currency: true },
      orderBy: { rateDate: 'desc' },
      take: 100,
    });
  }

  async setRate(
    organizationId: string,
    body: { currencyCode: string; rateDate: string; rateToBase: string; source?: string },
  ) {
    if (body.currencyCode === 'BDT') {
      throw new BadRequestException({
        error: { code: 'BASE_CURRENCY', message: 'BDT is the base currency.' },
      });
    }
    const currency = await prisma.currency.findFirst({
      where: { organizationId, code: body.currencyCode },
    });
    if (!currency) {
      throw new BadRequestException({
        error: { code: 'CURRENCY_NOT_FOUND', message: 'Currency not found. Seed defaults first.' },
      });
    }
    const rateDate = new Date(body.rateDate);
    return prisma.exchangeRate.upsert({
      where: {
        organizationId_currencyId_rateDate: {
          organizationId,
          currencyId: currency.id,
          rateDate,
        },
      },
      update: {
        rateToBase: body.rateToBase,
        source: body.source ?? 'manual',
      },
      create: {
        organizationId,
        currencyId: currency.id,
        rateDate,
        rateToBase: body.rateToBase,
        source: body.source ?? 'manual',
      },
      include: { currency: true },
    });
  }

  async rateOnDate(organizationId: string, currencyCode: string, asOf: string) {
    if (currencyCode === 'BDT') return { currencyCode: 'BDT', rateToBase: '1' };
    const currency = await prisma.currency.findFirst({
      where: { organizationId, code: currencyCode },
    });
    if (!currency) return null;
    const rate = await prisma.exchangeRate.findFirst({
      where: {
        organizationId,
        currencyId: currency.id,
        rateDate: { lte: new Date(asOf) },
      },
      orderBy: { rateDate: 'desc' },
    });
    return rate
      ? { currencyCode, rateToBase: rate.rateToBase.toString(), rateDate: rate.rateDate }
      : null;
  }
}
