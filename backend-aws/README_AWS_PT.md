# Desenvolvimento Lambda com AWS SAM

Este projecto foi gerado a partir da stack CFN existente `watt-builder-backend-fastapi-aws`, usando o AWS Toolkit para VS Code. As funções Lambda passam a estar organizadas como um projecto AWS Serverless Application Model (SAM).

Com SAM, podes gerir as funções como infraestrutura em código através do template SAM. Isto evita alterações manuais na consola AWS, melhora o controlo de versões e permite deployments automatizados dos recursos serverless.

## Pré-requisitos

Confirma que tens estas ferramentas instaladas:

- **AWS CLI**: necessária para interagir com serviços AWS a partir da linha de comandos.
- **AWS SAM CLI**: necessária para compilar, invocar e fazer deploy das funções localmente. É necessária a versão 1.98 ou superior.
- **Docker**: opcional, mas necessário se quiseres invocar funções localmente.

**Nota:** para ajuda na instalação destas ferramentas, abre o painel **Application Builder** no **EXPLORER** ou na extensão AWS Toolkit, e selecciona **Walkthrough of Application Builder**.

## O que podes fazer com AWS SAM

As funções estão prontas para desenvolvimento local. Podes usar o **AWS Application Builder** ou a **SAM CLI** para editar e gerir as funções.

Para começar com o Application Builder, abre o painel **Application Builder** no **EXPLORER** ou na extensão AWS Toolkit, e selecciona **Walkthrough of Application Builder**.

Comandos úteis da SAM CLI:

- **Compilar o código:** executa [`sam build`](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-cli-command-reference-sam-build.html) no terminal para compilar o código e instalar dependências.
- **Testar localmente:** executa [`sam local invoke`](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-cli-command-reference-sam-local-invoke.html) e [`sam local start-api`](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-cli-command-reference-sam-local-start-api.html) no terminal.
- **Fazer deploy das alterações:** executa [`sam deploy --guided`](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-cli-command-reference-sam-deploy.html) no terminal para publicar a função actualizada na AWS.
- **Verificar o deploy:** executa [`sam remote invoke`](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-cli-command-reference-remote-invoke.html) ou abre a consola Lambda.

## Referência rápida

- **Template SAM**: [template.yaml](./template.yaml), contém a infraestrutura como código.
- **Configuração SAM**: [samconfig.toml](./samconfig.toml), contém a configuração de deploy.

## Funcionalidades avançadas

Também podes depurar as funções localmente com breakpoints, gerir variáveis de ambiente, trabalhar com layers e dependências, e configurar triggers e permissões através da interface do AWS Toolkit.

Para mais detalhes, consulta:

- [Guia do utilizador do AWS Toolkit para Visual Studio Code](https://docs.aws.amazon.com/toolkit-for-vscode/latest/userguide/welcome.html)
- [Working with Application Builder](https://docs.aws.amazon.com/toolkit-for-vscode/latest/userguide/appbuilder-overview-overview.html)
- [AWS SAM Developer Guide](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/what-is-sam.html)
- [Referência da linha de comandos AWS SAM](http://https//docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-command-reference.html)

