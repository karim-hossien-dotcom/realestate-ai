.PHONY: install dev api up

install:
	npm install

dev:
	npm run dev

api:
	python3 tools/ai_inbound_agent.py

up:
	@echo "Run these in separate terminals:"
	@echo "1) make dev"
	@echo "2) make api"
