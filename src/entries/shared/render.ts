import htm from "htm"
import { h, VNode } from "preact";

export const html = htm.bind(h) as (strings: TemplateStringsArray, ...values: any[]) => VNode<any>
