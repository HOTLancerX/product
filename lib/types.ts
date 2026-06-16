/**
 * plugin/product/lib/types.ts
 *
 * Pure type definitions shared between server-only lib files and
 * plugin components. No imports — safe for any bundle (client or server).
 */

export interface CategoryProduct {
    _id:   string;
    title: string;
    slug:  string;
    info:  Record<string, string>;
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

export interface CategoryPageData {
    products:   CategoryProduct[];
    subCats:    CategorySubCat[];
    ancestors:  CategoryAncestor[];
    activeBox:  { label: string; pluginNx: string } | null;
}
