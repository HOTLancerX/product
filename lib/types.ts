/**
 * plugin/product/lib/types.ts
 *
 * Pure type definitions shared between server-only lib files and
 * plugin components. No imports — safe for any bundle (client or server).
 */

export interface CategoryProduct {
    _id:      string;
    title:    string;
    slug:     string;
    /** MongoDB _id of the product's assigned category (string) */
    category: string | null;
    info:     Record<string, string>;
}

export interface CategorySubCat {
    _id:   string;
    title: string;
    slug:  string;
}

export interface CategoryAncestor {
    _id:   string;
    title: string;
    slug:  string;
}

/**
 * One attribute group shown in the filter panel.
 * id     — the attribute category slug (used as URL param key: attr_<id>)
 * label  — display name (e.g. "Color", "Storage")
 * values — distinct values extracted from products in this category
 */
export interface AttributeOption {
    id:     string;
    label:  string;
    values: string[];
}

export interface CategoryPageData {
    products:         CategoryProduct[];
    subCats:          CategorySubCat[];
    ancestors:        CategoryAncestor[];
    activeBox:        { label: string; pluginNx: string } | null;
    /** Attribute filter groups — empty when no attributes are linked to this category */
    attributeOptions: AttributeOption[];
}
