import { Container } from "./Container";
import image from "./image.svg";
import "./cadastro.css";
import vector from "./vector.svg";
import vector2 from "./vector-2.svg";
import vector3 from "./vector-3.svg";
import vector4 from "./vector-4.svg";
import vector5 from "./vector-5.svg";
import vector6 from "./vector-6.svg";
import vector7 from "./vector-7.svg";
import vector8 from "./vector-8.svg";
import vector9 from "./vector-9.svg";
import vector10 from "./vector-10.svg";
import vector11 from "./vector-11.svg";
import vector12 from "./vector-12.svg";

export const ModeloDeRascunho = () => {
  return (
    <div className="modelo-de-rascunho">
      <div className="container-2">
        <div className="container-3">
          <div className="button">
            <div className="icon">
              <img className="vector" alt="Vector" src={vector} />
              <img className="img" alt="Vector" src={image} />
              <img className="vector-2" alt="Vector" src={vector2} />
            </div>
            <div className="text-wrapper-2">Entrar</div>
          </div>
          <div className="button-2">
            <div className="icon-2">
              <img className="vector-3" alt="Vector" src={vector3} />
              <img className="vector-4" alt="Vector" src={vector4} />
              <img className="vector-5" alt="Vector" src={vector5} />
              <img className="vector-6" alt="Vector" src={vector6} />
            </div>
            <div className="text-wrapper-3">Cadastrar</div>
          </div>
        </div>
        <div className="form">
          <div className="container-4">
            <div className="label">
              <div className="icon-3">
                <img className="vector-7" alt="Vector" src={vector7} />
                <img className="vector-8" alt="Vector" src={vector8} />
              </div>
              <div className="text-wrapper-4">Nome completo</div>
            </div>
            <div className="div-wrapper">
              <div className="text-wrapper-5">Digite seu nome</div>
            </div>
          </div>
          <div className="container-4">
            <div className="label">
              <div className="icon-3">
                <img className="vector-9" alt="Vector" src={vector9} />
                <img className="vector-10" alt="Vector" src={vector10} />
              </div>
              <div className="text-wrapper-4">E-mail</div>
            </div>
            <div className="div-wrapper">
              <div className="text-wrapper-5">seu@email.com</div>
            </div>
          </div>
          <div className="container-4">
            <div className="label">
              <div className="icon-3">
                <img className="vector-11" alt="Vector" src={vector11} />
                <img className="vector-12" alt="Vector" src={vector12} />
              </div>
              <div className="text-wrapper-4">Senha</div>
            </div>
            <div className="div-wrapper">
              <div className="text-wrapper-5">••••••••</div>
            </div>
          </div>
          <div className="button-3">
            <div className="text-wrapper-6">Criar conta</div>
          </div>
        </div>
        <button className="button-4">
          <div className="text-wrapper-7">Faça login</div>
        </button>
        <div className="j-tem-uma-conta">Já tem uma conta?</div>
        <Container
          className="container-instance"
          imageEstaciaClassName="design-component-instance-node"
          line="line-1-2.svg"
          lineClassName="container-5"
        />
      </div>
    </div>
  );
};