import image from "./image.svg";
import "./recuperar.css";
import vector from "./vector.svg";
import vector2 from "./vector-2.svg";
import vector3 from "./vector-3.svg";

export const ModeloDeRascunho = () => {
  return (
    <div className="modelo-de-rascunho">
      <div className="container">
        <div className="div">
          <div className="image-estacia" />
          <div className="heading">
            <div className="text-wrapper">Recuperar senha</div>
          </div>
          <div className="paragraph">
            <p className="p">Digite seu e-mail para receber as instruções</p>
          </div>
        </div>
        <div className="form">
          <div className="container-2">
            <div className="label">
              <div className="icon">
                <img className="vector" alt="Vector" src={vector} />
                <img className="img" alt="Vector" src={image} />
              </div>
              <div className="text-wrapper-2">E-mail cadastrado</div>
            </div>
            <div className="email-input">
              <div className="text-wrapper-3">seu@email.com</div>
            </div>
          </div>
          <div className="button">
            <div className="text-wrapper-4">Enviar instruções</div>
          </div>
          <div className="button-2">
            <div className="icon-2">
              <img className="vector-2" alt="Vector" src={vector2} />
              <img className="vector-3" alt="Vector" src={vector3} />
            </div>
            <div className="text-wrapper-5">Voltar ao login</div>
          </div>
        </div>
      </div>
    </div>
  );
};