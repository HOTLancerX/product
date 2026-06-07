/**
 * single.tsx — Field definitions for the "single" product price type.
 *
 * Each field is rendered by PostForm's variate handler.
 * Fields are ordered by `position` and placed in the layout via `style`.
 */

import { Text } from "@/components/ui/Text";
import { Number } from "@/components/ui/Number";

export interface SingleField {
    key: string;
    label: string;
    type: string;
    style: "left" | "right";
    position: number;
    component: React.ComponentType<any>;
}

export const singleFields: SingleField[] = [
    {
        key: "regularprice",
        label: "Regular Price",
        type: "product",
        style: "right",
        position: 10,
        component: Text,
    },
    {
        key: "sellingprice",
        label: "Sale Price",
        type: "product",
        style: "right",
        position: 15,
        component: Text,
    },
    {
        key: "stock",
        label: "Stock Quantity",
        type: "product",
        style: "right",
        position: 30,
        component: Number,
    },
];
