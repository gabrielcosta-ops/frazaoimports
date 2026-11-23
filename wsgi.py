"""Ponto de entrada do PythonAnywhere.

No painel Web, o arquivo WSGI da conta deve apontar para esta pasta e expor
`application`. O arquivo de configuração do painel fica fora do projeto; cole
nele o exemplo do README, trocando SEU_USUARIO.
"""

from app import app as application
