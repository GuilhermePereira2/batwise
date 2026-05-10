#!/bin/bash
# Cria a tabela DynamoDB online para guardar inputs de simulações.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."

load_env_file() {
    local env_file="$1"
    while IFS= read -r line || [ -n "$line" ]; do
        line="${line%%#*}"
        line="${line#"${line%%[![:space:]]*}"}"
        line="${line%"${line##*[![:space:]]}"}"
        if [ -n "$line" ] && [[ "$line" == *=* ]]; then
            export "$line"
        fi
    done < "$env_file"
}

if [ -f "$ROOT_DIR/.env" ]; then
    load_env_file "$ROOT_DIR/.env"
fi

AWS_REGION="${AWS_REGION:-eu-west-3}"
AWS_PROFILE="${AWS_PROFILE:-duarte}"
SIMULATION_INPUTS_TABLE_NAME="${SIMULATION_INPUTS_TABLE_NAME:-watt-builder-SimulationInputs}"

echo "📊 Verificando tabela '$SIMULATION_INPUTS_TABLE_NAME' em AWS ($AWS_REGION)..."

if aws dynamodb describe-table \
    --table-name "$SIMULATION_INPUTS_TABLE_NAME" \
    --region "$AWS_REGION" \
    --profile "$AWS_PROFILE" >/dev/null 2>&1; then
    echo "✅ Tabela '$SIMULATION_INPUTS_TABLE_NAME' já existe."
    exit 0
fi

aws dynamodb create-table \
    --table-name "$SIMULATION_INPUTS_TABLE_NAME" \
    --attribute-definitions \
        AttributeName=simulationId,AttributeType=S \
        AttributeName=email,AttributeType=S \
    --key-schema \
        AttributeName=simulationId,KeyType=HASH \
    --global-secondary-indexes \
        "IndexName=email-index,KeySchema=[{AttributeName=email,KeyType=HASH}],Projection={ProjectionType=ALL}" \
    --billing-mode PAY_PER_REQUEST \
    --region "$AWS_REGION" \
    --profile "$AWS_PROFILE"

echo "✅ Tabela '$SIMULATION_INPUTS_TABLE_NAME' criada."
