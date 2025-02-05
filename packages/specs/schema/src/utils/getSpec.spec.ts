import {validateSpec} from "../../test/helpers/validateSpec";
import {CollectionOf} from "../decorators/collections/collectionOf";
import {Min} from "../decorators/common/minimum";
import {Name} from "../decorators/common/name";
import {Property} from "../decorators/common/property";
import {Required} from "../decorators/common/required";
import {Consumes} from "../decorators/operations/consumes";
import {In} from "../decorators/operations/in";
import {OperationPath} from "../decorators/operations/operationPath";
import {Returns} from "../decorators/operations/returns";
import {JsonParameterTypes} from "../domain/JsonParameterTypes";
import {SpecTypes} from "../domain/SpecTypes";
import {getSpec} from "./getSpec";

describe("getSpec()", () => {
  describe("with on controller", () => {
    describe("In", () => {
      describe("Path", () => {
        it("should declare all schema correctly (path - openspec3)", async () => {
          // WHEN
          class Controller {
            @OperationPath("GET", "/:basic")
            method(@In("path") @Name("basic") basic: string) {}
          }

          // THEN
          const spec = getSpec(Controller, {
            specType: SpecTypes.OPENAPI
          });
          expect(spec).toEqual({
            paths: {
              "/{basic}": {
                get: {
                  operationId: "controllerMethod",
                  parameters: [
                    {
                      in: "path",
                      name: "basic",
                      required: true,
                      schema: {type: "string"}
                    }
                  ],
                  responses: {
                    "200": {
                      description: "Success"
                    }
                  },
                  tags: ["Controller"]
                }
              }
            },
            tags: [
              {
                name: "Controller"
              }
            ]
          });
          expect(await validateSpec(spec, SpecTypes.OPENAPI)).toBe(true);
        });
        it("should declare all schema correctly (path optional - openspec3)", async () => {
          // WHEN
          class Controller {
            @OperationPath("GET", "/:id?")
            method(@In("path") @Name("id") id: string) {}
          }

          // THEN
          const spec = getSpec(Controller, {specType: SpecTypes.OPENAPI});

          expect(await validateSpec(spec, SpecTypes.OPENAPI)).toBe(true);
          expect(spec).toEqual({
            paths: {
              "/": {
                get: {
                  operationId: "controllerMethod",
                  parameters: [],
                  responses: {
                    "200": {
                      description: "Success"
                    }
                  },
                  tags: ["Controller"]
                }
              },
              "/{id}": {
                get: {
                  operationId: "controllerMethodById",
                  parameters: [
                    {
                      in: "path",
                      name: "id",
                      required: true,
                      schema: {
                        type: "string"
                      }
                    }
                  ],
                  responses: {
                    "200": {
                      description: "Success"
                    }
                  },
                  tags: ["Controller"]
                }
              }
            },
            tags: [
              {
                name: "Controller"
              }
            ]
          });
        });
      });
      describe("Query", () => {
        it("should declare all schema correctly (query -  openspec3 - model)", async () => {
          // WHEN
          class QueryModel {
            @Property()
            id: string;

            @Property()
            name: string;
          }

          class Controller {
            @OperationPath("GET", "/:id")
            method(@In("query") basic: QueryModel) {}
          }

          // THEN
          const spec = getSpec(Controller, {specType: SpecTypes.OPENAPI});
          expect(spec).toEqual({
            paths: {
              "/{id}": {
                get: {
                  operationId: "controllerMethod",
                  parameters: [
                    {in: "path", name: "id", required: true, schema: {type: "string"}},
                    {in: "query", required: false, name: "id", schema: {type: "string"}},
                    {in: "query", required: false, name: "name", schema: {type: "string"}}
                  ],
                  responses: {"200": {description: "Success"}},
                  tags: ["Controller"]
                }
              }
            },
            tags: [{name: "Controller"}]
          });
        });
        it("should declare all schema correctly (query -  openspec3 - array string)", async () => {
          // WHEN
          class Controller {
            @OperationPath("GET", "/:id")
            method(@In("query") @Name("basic") basic: string[]) {}
          }

          // THEN
          const spec = getSpec(Controller, {specType: SpecTypes.OPENAPI});

          expect(spec).toEqual({
            paths: {
              "/{id}": {
                get: {
                  operationId: "controllerMethod",
                  parameters: [
                    {
                      in: "path",
                      name: "id",
                      required: true,
                      schema: {type: "string"}
                    },
                    {
                      in: "query",
                      name: "basic",
                      required: false,
                      schema: {
                        items: {
                          type: "object"
                        },
                        type: "array"
                      }
                    }
                  ],
                  responses: {
                    "200": {
                      description: "Success"
                    }
                  },
                  tags: ["Controller"]
                }
              }
            },
            tags: [
              {
                name: "Controller"
              }
            ]
          });
        });
        it("should declare all schema correctly (query -  openspec3 - Map)", async () => {
          // WHEN
          class Controller {
            @OperationPath("GET", "/:id")
            method(@In("query") @Name("basic") @CollectionOf(String) basic: Map<string, string>) {}
          }

          // THEN
          const spec = getSpec(Controller, {specType: SpecTypes.OPENAPI});

          expect(spec).toEqual({
            paths: {
              "/{id}": {
                get: {
                  operationId: "controllerMethod",
                  parameters: [
                    {
                      in: "path",
                      name: "id",
                      required: true,
                      schema: {type: "string"}
                    },
                    {
                      in: "query",
                      name: "basic",
                      required: false,
                      schema: {
                        additionalProperties: {
                          type: "string"
                        },
                        type: "object"
                      }
                    }
                  ],
                  responses: {
                    "200": {
                      description: "Success"
                    }
                  },
                  tags: ["Controller"]
                }
              }
            },
            tags: [
              {
                name: "Controller"
              }
            ]
          });
        });
      });
      describe("Body", () => {
        it("should declare all schema correctly (model -  openspec3)", async () => {
          class MyModel {
            @Property()
            prop: string;
          }

          class Controller {
            @Consumes("application/json")
            @OperationPath("POST", "/")
            method(@In("body") @Required() num: MyModel) {}
          }

          // THEN
          const spec = getSpec(Controller, {specType: SpecTypes.OPENAPI});

          expect(spec).toEqual({
            components: {
              schemas: {
                MyModel: {
                  properties: {
                    prop: {
                      type: "string"
                    }
                  },
                  type: "object"
                }
              }
            },
            tags: [
              {
                name: "Controller"
              }
            ],
            paths: {
              "/": {
                post: {
                  operationId: "controllerMethod",
                  parameters: [],
                  requestBody: {
                    content: {
                      "application/json": {
                        schema: {
                          $ref: "#/components/schemas/MyModel"
                        }
                      }
                    },
                    required: true
                  },
                  tags: ["Controller"],
                  responses: {
                    "200": {
                      description: "Success"
                    }
                  }
                }
              }
            }
          });
        });
        it("should declare all schema correctly (Array - inline - OS3)", async () => {
          class Product {
            @Property()
            title: string;
          }

          class Controller {
            @Consumes("application/json")
            @OperationPath("POST", "/")
            method(@In("body") @Required() @CollectionOf(Product) products: Product[]) {}
          }

          // THEN
          const spec = getSpec(Controller, {specType: SpecTypes.OPENAPI});

          expect(spec).toEqual({
            components: {
              schemas: {
                Product: {
                  properties: {
                    title: {
                      type: "string"
                    }
                  },
                  type: "object"
                }
              }
            },
            paths: {
              "/": {
                post: {
                  operationId: "controllerMethod",
                  parameters: [],
                  requestBody: {
                    content: {
                      "application/json": {
                        schema: {
                          items: {
                            $ref: "#/components/schemas/Product"
                          },
                          type: "array"
                        }
                      }
                    },
                    required: true
                  },
                  responses: {
                    "200": {
                      description: "Success"
                    }
                  },
                  tags: ["Controller"]
                }
              }
            },
            tags: [
              {
                name: "Controller"
              }
            ]
          });
        });
        it("should declare all schema correctly (Array - inline - number - OS3)", async () => {
          class Controller {
            @Consumes("application/json")
            @OperationPath("POST", "/")
            method(@In("body") products: number[]) {}
          }

          // THEN
          const spec = getSpec(Controller, {specType: SpecTypes.OPENAPI});

          expect(spec).toEqual({
            paths: {
              "/": {
                post: {
                  operationId: "controllerMethod",
                  parameters: [],
                  requestBody: {
                    content: {
                      "application/json": {
                        schema: {
                          type: "array",
                          items: {
                            type: "object"
                          }
                        }
                      }
                    },
                    required: false
                  },
                  responses: {
                    "200": {
                      description: "Success"
                    }
                  },
                  tags: ["Controller"]
                }
              }
            },
            tags: [
              {
                name: "Controller"
              }
            ]
          });
        });
        it("should declare all schema correctly (inline -  openspec3)", async () => {
          class Controller {
            @Consumes("application/json")
            @OperationPath("POST", "/")
            method(
              @In("body") @Required() @Name("num") @CollectionOf(Number) @Min(0) num: number[],
              @In("body") @Required() @Name("test") @Min(0) num2: number
            ) {}
          }

          // THEN
          const spec = getSpec(Controller, {specType: SpecTypes.OPENAPI});
          expect(await validateSpec(spec, SpecTypes.OPENAPI)).toBe(true);
          expect(spec).toEqual({
            tags: [
              {
                name: "Controller"
              }
            ],
            paths: {
              "/": {
                post: {
                  operationId: "controllerMethod",
                  parameters: [],
                  requestBody: {
                    content: {
                      "application/json": {
                        schema: {
                          properties: {
                            num: {
                              items: {
                                minimum: 0,
                                type: "number"
                              },
                              type: "array"
                            },
                            test: {
                              minimum: 0,
                              type: "number"
                            }
                          },
                          required: ["num", "test"],
                          type: "object"
                        }
                      }
                    },
                    required: true
                  },
                  responses: {
                    "200": {
                      description: "Success"
                    }
                  },
                  tags: ["Controller"]
                }
              }
            }
          });
        });
      });
      describe("Cookies", () => {
        it("should declare all schema correctly (OS3)", async () => {
          class Controller {
            @Consumes("application/json")
            @OperationPath("POST", "/")
            method(@In(JsonParameterTypes.COOKIES) @Name("hello") @Required() hello: string) {}
          }

          // THEN
          const spec = getSpec(Controller, {specType: SpecTypes.OPENAPI});

          expect(spec).toEqual({
            tags: [
              {
                name: "Controller"
              }
            ],
            paths: {
              "/": {
                post: {
                  operationId: "controllerMethod",
                  parameters: [
                    {
                      in: "cookie",
                      name: "hello",
                      required: true,
                      schema: {
                        type: "string"
                      }
                    }
                  ],
                  tags: ["Controller"],
                  responses: {
                    "200": {
                      description: "Success"
                    }
                  }
                }
              }
            }
          });
        });
      });
    });
    describe("Response", () => {
      it("should declare all schema correctly (openspec3)", async () => {
        // WHEN
        class Controller {
          @OperationPath("POST", "/")
          @Returns(200, String).Description("description")
          method() {}
        }

        // THEN
        const spec = getSpec(Controller, {specType: SpecTypes.OPENAPI});

        expect(spec).toEqual({
          tags: [
            {
              name: "Controller"
            }
          ],
          paths: {
            "/": {
              post: {
                operationId: "controllerMethod",
                parameters: [],
                tags: ["Controller"],
                responses: {
                  "200": {
                    content: {
                      "*/*": {
                        schema: {
                          type: "string"
                        }
                      }
                    },
                    description: "description"
                  }
                }
              }
            }
          }
        });
      });
      it("should declare an Array of string (openspec3)", async () => {
        // WHEN
        class Controller {
          @OperationPath("POST", "/")
          @Returns(200, Array).Of(String).Description("description")
          method() {}
        }

        // THEN
        const spec = getSpec(Controller, {specType: SpecTypes.OPENAPI});

        expect(spec).toEqual({
          tags: [
            {
              name: "Controller"
            }
          ],
          paths: {
            "/": {
              post: {
                operationId: "controllerMethod",
                parameters: [],
                tags: ["Controller"],
                responses: {
                  "200": {
                    content: {
                      "application/json": {
                        schema: {
                          items: {
                            type: "string"
                          },
                          type: "array"
                        }
                      }
                    },
                    description: "description"
                  }
                }
              }
            }
          }
        });
      });
    });
  });
});
