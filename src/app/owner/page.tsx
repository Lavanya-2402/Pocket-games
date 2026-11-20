import type { Metadata } from "next";
import { Owner } from "./owner";

export const metadata: Metadata = { title: "Owner tools · Pocket Games", robots: { index: false } };

export default function OwnerPage() {
  return <Owner />;
}
