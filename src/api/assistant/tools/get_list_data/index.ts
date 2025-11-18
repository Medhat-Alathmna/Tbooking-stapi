import definition from "./definition";
import execute from "./execute";

export * from "./definition";
export * from "./execute";

const getListDataTool = {
  name: definition.name,
  definition,
  execute,
};

export default getListDataTool;

