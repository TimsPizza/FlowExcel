import Layout from "@/routes/Layout";
import { createHashRouter, RouteObject } from "react-router-dom";

const routes: RouteObject[] = [
  {
    path: "/",
    element: <Layout />,
    children: [{}],
  },
];

export const router = createHashRouter(routes);
