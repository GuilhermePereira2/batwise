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
    SHELL_AWS_PROFILE="${AWS_PROFILE:-}"
    load_env_file "$ROOT_DIR/.env"
    if [ -n "$SHELL_AWS_PROFILE" ]; then
        AWS_PROFILE="$SHELL_AWS_PROFILE"
    else
        unset AWS_PROFILE
    fi
fi

AWS_REGION="${AWS_REGION:-eu-west-3}"
SIMULATION_INPUTS_TABLE_NAME="${SIMULATION_INPUTS_TABLE_NAME:-watt-builder-SimulationInputs}"
AWS_PROFILE_ARGS=()
if [ -n "${AWS_PROFILE:-}" ]; then
    AWS_PROFILE_ARGS=(--profile "$AWS_PROFILE")
fi

echo "📊 Verificando tabela '$SIMULATION_INPUTS_TABLE_NAME' em AWS ($AWS_REGION)..."

if aws dynamodb describe-table \
    --table-name "$SIMULATION_INPUTS_TABLE_NAME" \
    --region "$AWS_REGION" \
    "${AWS_PROFILE_ARGS[@]}" >/dev/null 2>&1; then
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
    "${AWS_PROFILE_ARGS[@]}"

echo "✅ Tabela '$SIMULATION_INPUTS_TABLE_NAME' criada."
