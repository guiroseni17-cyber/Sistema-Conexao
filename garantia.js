// Termo de garantia fixo, impresso em todos os recibos (campo Observações).
// Para alterar o texto, edite apenas este arquivo.
const GARANTIA_LOJA = {
    titulo: 'TERMO DE GARANTIA DE APARELHO CELULAR',
    secoes: [
        {
            titulo: '1. PRAZO DA GARANTIA',
            linhas: [
                'A empresa garante o aparelho identificado neste documento pelo prazo legal de 90 (noventa) dias, contado da data de sua efetiva entrega ao consumidor, nos termos do Código de Defesa do Consumidor.',
                'Quando se tratar de vício oculto, assim entendido o defeito que não poderia ser facilmente constatado no momento da compra, o prazo para reclamação será contado a partir da data em que o problema se tornar evidente, observada a legislação aplicável.',
                'A garantia legal independe da apresentação deste termo, não podendo suas disposições limitar ou excluir direitos assegurados pela legislação.'
            ]
        },
        {
            titulo: '2. COBERTURA DA GARANTIA',
            linhas: [
                'A garantia cobre vícios de qualidade, defeitos de funcionamento ou falhas internas que tornem o aparelho impróprio ou inadequado ao uso a que se destina, desde que não sejam decorrentes de mau uso, acidente, intervenção de terceiros ou de qualquer das hipóteses de exclusão previstas neste termo.',
                'Entre os problemas que poderão ser abrangidos pela garantia, após avaliação técnica, estão:',
                'a) falhas de inicialização ou desligamentos involuntários;',
                'b) defeitos no sistema de carregamento, quando não provocados por danos físicos, umidade, oxidação, uso de acessórios incompatíveis ou problemas externos de energia;',
                'c) falhas no display, touchscreen, câmeras, alto-falantes, microfones, botões, conectores ou demais componentes internos;',
                'd) defeitos de placa ou componentes eletrônicos;',
                'e) falhas de conectividade, quando comprovadamente relacionadas ao aparelho;',
                'f) outros vícios internos existentes no produto e não causados pelo consumidor ou por terceiros.',
                'A existência do defeito e sua causa serão verificadas mediante avaliação técnica.',
                'O desgaste natural decorrente do tempo e do uso anterior deverá ser considerado de acordo com a idade, o estado e as condições expressamente informadas no momento da compra, sem prejuízo da garantia relativa a vícios ocultos ou defeitos não informados.'
            ]
        },
        {
            titulo: '3. BATERIA',
            linhas: [
                'A bateria é um componente sujeito ao desgaste natural decorrente do uso, da quantidade de ciclos de carga, da temperatura, do tempo de fabricação e dos hábitos de utilização.',
                'A redução gradual da autonomia, compatível com o desgaste natural e com o estado informado no momento da compra, não caracteriza, isoladamente, defeito.',
                'A garantia poderá ser aplicada quando houver falha anormal, estufamento, desligamentos inesperados, impossibilidade de carregamento ou perda excessiva de desempenho incompatível com as condições informadas, desde que o problema não tenha sido causado por mau uso, impacto, umidade, utilização de carregadores inadequados, alteração do aparelho ou outro fator externo.'
            ]
        },
        {
            titulo: '4. SITUAÇÕES NÃO COBERTAS',
            linhas: [
                'A garantia não será aplicável quando, após avaliação técnica, ficar comprovado que o defeito decorreu de:',
                'a) queda, impacto, pressão, esmagamento, quebra, trinca, amassado ou dano físico;',
                'b) contato com água, líquidos, vapor, suor excessivo, maresia, produtos químicos ou umidade;',
                'c) oxidação ou corrosão interna;',
                'd) uso inadequado, negligente ou em desacordo com as orientações do fabricante;',
                'e) utilização de carregadores, cabos, baterias, adaptadores, acessórios ou fontes de energia inadequados, incompatíveis ou defeituosos;',
                'f) oscilação, descarga elétrica, curto-circuito ou problemas na rede elétrica;',
                'g) abertura, desmontagem, reparo, troca de peças ou intervenção realizada por pessoa ou assistência técnica não autorizada pela empresa durante o período de atendimento da garantia;',
                'h) instalação de programas maliciosos, modificação não autorizada do sistema operacional, desbloqueio indevido, root, jailbreak ou alteração de software;',
                'i) bloqueio de IMEI, conta Apple/iCloud, conta Google, Samsung Account, senha, controle parental, restrição de operadora ou impedimento decorrente de ato do consumidor ou de terceiro;',
                'j) perda, furto, roubo, apreensão ou qualquer fato não relacionado a defeito do produto;',
                'k) danos estéticos decorrentes do uso posterior à compra, como riscos, manchas, descascamentos e amassados;',
                'l) desgaste natural de componentes, quando compatível com o tempo e a forma de utilização;',
                'm) danos causados por armazenamento inadequado, exposição excessiva ao calor, frio, poeira ou agentes externos;',
                'n) defeitos decorrentes de aplicativos, atualizações, serviços de terceiros, operadoras, redes de internet, plataformas digitais ou sistemas externos ao aparelho;',
                'o) adulteração, remoção ou impossibilidade de identificação do número de série ou IMEI.',
                'As exclusões acima somente serão aplicadas quando houver relação entre a conduta, o evento externo ou a intervenção realizada e o defeito apresentado.'
            ]
        },
        {
            titulo: '5. PROCEDIMENTO PARA ACIONAMENTO DA GARANTIA',
            linhas: [
                'Para solicitar atendimento, o consumidor deverá entrar em contato com a empresa e apresentar, sempre que possível:',
                'a) o aparelho objeto da reclamação;',
                'b) nota fiscal, recibo, comprovante de compra ou outro documento que permita identificar a contratação;',
                'c) este termo de garantia, caso disponível;',
                'd) descrição detalhada do problema apresentado;',
                'e) senha temporária de acesso, quando indispensável para a realização dos testes, podendo o consumidor removê-la após a conclusão do atendimento.',
                'O aparelho deverá ser entregue sem capas, películas, cartões de memória, chips, suportes ou acessórios pessoais, salvo quando tais itens forem necessários para a verificação do defeito.',
                'No ato do recebimento, será emitida ordem de serviço ou comprovante contendo a identificação do aparelho, seu estado aparente, os acessórios entregues e o defeito relatado.'
            ]
        },
        {
            titulo: '6. ANÁLISE TÉCNICA E PRAZO PARA REPARO',
            linhas: [
                'O simples recebimento do aparelho não representa reconhecimento automático da cobertura da garantia. O produto será submetido à avaliação técnica para identificação do defeito e de sua possível causa.',
                'Sendo constatado defeito coberto pela garantia, a empresa providenciará o reparo sem custo ao consumidor, observados os prazos e as alternativas previstos no Código de Defesa do Consumidor.',
                'O fornecedor terá o prazo máximo legal de 30 (trinta) dias para sanar o vício, contado do recebimento do aparelho ou da formalização da reclamação, conforme o caso.',
                'Não sendo o defeito solucionado dentro do prazo aplicável, o consumidor poderá exercer as alternativas previstas na legislação, inclusive:',
                'a) substituição do produto por outro da mesma espécie, em condições adequadas de uso;',
                'b) restituição do valor pago, devidamente atualizado; ou',
                'c) abatimento proporcional do preço.',
                'A solução aplicada deverá considerar a disponibilidade do produto, as características do aparelho e os direitos assegurados ao consumidor.'
            ]
        },
        {
            titulo: '7. APARELHO SUBSTITUTO',
            linhas: [
                'A empresa não está obrigada a fornecer aparelho substituto durante o período de análise ou reparo, salvo quando esse fornecimento tiver sido expressamente oferecido, contratado ou decorrer de obrigação legal ou decisão da autoridade competente.',
                'Caso seja fornecido aparelho temporário, será elaborado termo específico de entrega e responsabilidade.'
            ]
        },
        {
            titulo: '8. DEVOLUÇÕES E DIREITO DE ARREPENDIMENTO',
            linhas: [
                'Nas compras realizadas presencialmente no estabelecimento comercial, não será realizada troca ou devolução por mera preferência, arrependimento, escolha de cor ou modelo, incompatibilidade com acessórios ou aplicativos, ou qualquer outro motivo não relacionado à existência de vício ou defeito no produto.',
                'As trocas, substituições, reparos ou restituições somente ocorrerão nas hipóteses previstas na legislação aplicável, especialmente quando constatado vício ou defeito coberto pela garantia.'
            ]
        },
        {
            titulo: '9. DISPOSIÇÕES FINAIS',
            linhas: [
                'Este termo deverá ser interpretado em conjunto com o recibo, ordem de serviço, oferta, anúncio e demais documentos relativos à compra.',
                'Nenhuma disposição deste documento poderá ser utilizada para excluir, restringir ou reduzir direitos obrigatoriamente assegurados ao consumidor.',
                'O consumidor declara que recebeu informações claras sobre o aparelho, suas condições, funcionalidades, estado de conservação, prazo de garantia e procedimento de atendimento.',
                'As partes buscarão solucionar eventuais divergências de forma amigável, sem prejuízo do direito de recorrer aos órgãos de proteção e defesa do consumidor ou ao Poder Judiciário.',
                'Por estarem de acordo, as partes assinam o presente termo em duas vias de igual teor.'
            ]
        }
    ]
};
