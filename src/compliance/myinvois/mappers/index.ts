export * from "./canonical-json";
export * from "./invoice-v1_1.mapper";
export * from "./invoice-v1_0.mapper";
export * from "./mapper";
export * from "./mapper-registry";

import { invoiceV10Mapper } from "./invoice-v1_0.mapper";
import { invoiceV11Mapper } from "./invoice-v1_1.mapper";
import { MyInvoisMapperRegistry } from "./mapper-registry";

export const MYINVOIS_MAPPER_REGISTRY = new MyInvoisMapperRegistry([invoiceV10Mapper, invoiceV11Mapper]);
