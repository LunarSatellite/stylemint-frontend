export type BriefId       = string & { readonly __brand: 'BriefId' }
export type VendorId      = string & { readonly __brand: 'VendorId' }
export type TemplateId    = string & { readonly __brand: 'TemplateId' }
export type PartnershipId = string & { readonly __brand: 'PartnershipId' }
export type ProductId     = string & { readonly __brand: 'ProductId' }

export const asBriefId       = (s: string): BriefId       => s as BriefId
export const asVendorId      = (s: string): VendorId      => s as VendorId
export const asTemplateId    = (s: string): TemplateId    => s as TemplateId
export const asPartnershipId = (s: string): PartnershipId => s as PartnershipId
export const asProductId     = (s: string): ProductId     => s as ProductId
