import {InjectContext, PlatformApplication, PlatformContext} from "@tsed/common";
import {Env, setValue} from "@tsed/core";
import {Constant, Inject, Injectable, InjectorService} from "@tsed/di";
// @ts-ignore
import type {Configuration, interactionPolicy, KoaContextWithOIDC, default as OIDCProvider} from "oidc-provider";
import {INTERACTIONS} from "../constants/constants";
import {InteractionMethods} from "../domain/InteractionMethods";
import {OidcAccountsMethods} from "../domain/OidcAccountsMethods";
import {OidcInteractionOptions} from "../domain/OidcInteractionOptions";
import {OidcSettings} from "../domain/OidcSettings";
import {OIDC_ERROR_EVENTS} from "../utils/events";
import {OidcAdapters} from "./OidcAdapters";
import {OidcInteractions} from "./OidcInteractions";
import {OidcJwks} from "./OidcJwks";

function mapError(error: any) {
  return Object.getOwnPropertyNames(error).reduce((obj: any, key) => {
    return {
      ...obj,
      [key]: error[key]
    };
  }, {});
}

@Injectable()
export class OidcProvider {
  raw: OIDCProvider;

  @Constant("env")
  protected env: Env;

  @Constant("httpPort")
  protected httpPort: number | string;

  @Constant("httpsPort")
  protected httpsPort: number | string;

  @Constant("oidc.issuer", "")
  protected issuer: string;

  @Constant("oidc")
  protected oidc: OidcSettings;

  @Constant("PLATFORM_NAME")
  protected platformName: string;

  @Inject()
  protected oidcJwks: OidcJwks;

  @Inject()
  protected oidcInteractions: OidcInteractions;

  @Inject()
  protected adapters: OidcAdapters;

  @Inject()
  protected injector: InjectorService;

  @Inject()
  protected app: PlatformApplication;

  @InjectContext()
  protected $ctx?: PlatformContext;

  get logger() {
    return this.$ctx?.logger || this.injector.logger;
  }

  hasConfiguration() {
    return !!this.oidc;
  }

  async getConfiguration(): Promise<Configuration> {
    const [jwks, adapter] = await Promise.all([this.oidcJwks.getJwks(), this.adapters.createAdapterClass()]);
    const {
      issuer,
      jwksPath,
      secureKey,
      proxy,
      Accounts,
      secureCookies = this.env == Env.PROD,
      Adapter,
      connectionName,
      ...options
    } = this.oidc;

    const configuration: Configuration = {
      interactions: {
        /* istanbul ignore next */
        url: (ctx, interaction) => `interaction/${interaction.uid}`
      },
      ...options,
      adapter,
      jwks
    };

    if (Accounts) {
      configuration.findAccount = (ctx, id, token) => this.injector.get<OidcAccountsMethods>(Accounts)!.findAccount(id, token);
    }

    if (secureCookies) {
      setValue(configuration, "cookies.short.secure", true);
      setValue(configuration, "cookies.long.secure", true);
    }

    const policy = await this.getPolicy();
    if (policy) {
      setValue(configuration, "interactions.policy", policy);
    }

    const url = this.getInteractionsUrl();
    if (url) {
      setValue(configuration, "interactions.url", url);
    }

    return configuration;
  }

  getIssuer() {
    if (this.issuer) {
      return this.issuer;
    }

    // istanbul ignore next
    if (this.httpsPort) {
      return `https://localhost:${this.httpsPort}`;
    }

    return `http://localhost:${this.httpPort}`;
  }

  get(): OIDCProvider {
    return this.raw;
  }

  /**
   * Create a new instance of OidcProvider
   */
  async create(): Promise<void | OIDCProvider> {
    const {proxy = this.env === Env.PROD, secureKey, allowHttpLocalhost = this.env !== Env.PROD} = this.oidc;
    const configuration = await this.getConfiguration();

    const mod = await import("oidc-provider");
    await this.injector.alterAsync("$alterOidcConfiguration", configuration);

    const Provider = (mod.default || (mod as any).Provider) as unknown as any;
    const oidcProvider = new Provider(this.getIssuer(), configuration);

    if (proxy) {
      // istanbul ignore next
      switch (this.platformName) {
        default:
        case "express":
          oidcProvider.proxy = true;
          break;
        case "koa":
          (this.app.rawApp as any).proxy = true;
          break;
      }
    }

    if (secureKey) {
      oidcProvider.app.keys = secureKey;
    }

    this.raw = oidcProvider;

    if (allowHttpLocalhost) {
      this.allowHttpLocalhost();
    }

    OIDC_ERROR_EVENTS.map((event) => {
      this.raw.on(event, this.createErrorHandler(event));
    });

    await this.injector.emit("$onCreateOIDC", this.raw);

    return this.raw;
  }

  public async createPrompt(instance: InteractionMethods, options: OidcInteractionOptions) {
    const {interactionPolicy} = await import("oidc-provider");

    const {checks: originalChecks = [], details, ...promptOptions} = options;
    const checks = [...(instance.checks ? instance.checks() : originalChecks)].filter(Boolean);

    return new interactionPolicy.Prompt(promptOptions, instance.details ? instance.details.bind(instance) : details, ...checks);
  }

  private createErrorHandler(event: string) {
    return (ctx: KoaContextWithOIDC, error: any, accountId?: string, sid?: string) => {
      this.logger.error({
        event: "OIDC_ERROR",
        type: event,
        error: mapError(error),
        account_id: accountId,
        params: ctx.oidc.params,
        headers: ctx.headers,
        sid
      });

      // TODO see if we need to call platformExceptions
      // this.platformExceptions.catch(error, ctx.request.$ctx);
    };
  }

  private getInteractionsUrl() {
    const provider = this.injector.getProviders().find((provider) => provider.subType === INTERACTIONS);

    if (provider) {
      return (ctx: any, interaction: any) => {
        // eslint-disable-line no-unused-vars
        return provider.path.replace(/:uid/, interaction.uid);
      };
    }
  }

  private allowHttpLocalhost() {
    const {invalidate: orig} = (this.raw.Client as any).Schema.prototype;

    (this.raw.Client as any).Schema.prototype.invalidate = function invalidate(message: string, code: string) {
      if (code === "implicit-force-https" || code === "implicit-forbid-localhost") {
        return;
      }

      /* istanbul ignore next */
      return orig.call(this, message);
    };
  }

  private async getPolicy() {
    const {interactionPolicy} = await import("oidc-provider");
    const policy = interactionPolicy.base();
    const interactions = this.oidcInteractions.getInteractions();

    if (interactions.length) {
      for (const provider of interactions) {
        const instance = this.injector.get<InteractionMethods>(provider.token)!;
        const options = provider.store.get("interactionOptions");

        if (!policy.get(options.name)) {
          const prompt = await this.createPrompt(instance, options);

          policy.add(prompt, options.priority);
        }

        if (instance.$onCreate) {
          instance.$onCreate(policy.get(options.name)!);
        }
      }
    }

    return this.injector.alter("$alterOidcPolicy", policy);
  }
}
